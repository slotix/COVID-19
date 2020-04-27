package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/jasonlvhit/gocron"
)

type Config struct {
	Host string
}

// HTMLServer represents the web service that serves up HTML
type HTMLServer struct {
	server *http.Server
	wg     sync.WaitGroup
}

var (
	payloadFilePath   = flag.String("z", "./coronaPayload.json", "COVID-19 Payload file")
	dfkParseAPIServer = flag.String("p", "https://api.dataflowkit.com/v1/parse?api_key=", "DFK API Server address")
	apiKey            = flag.String("a", "", "DFK API Key")
	covidStatistics   []map[string]string
)

func init() {
	flag.Parse()
}

func main() {
	serverCfg := Config{
		Host: "0.0.0.0:8008",
	}
	htmlServer := Start(serverCfg)
	defer htmlServer.Stop()

	stopScheduler := make(chan struct{})
	go runScheduler(stopScheduler)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)
	<-sigChan
	close(stopScheduler)

	fmt.Println("COVID-19 Service: shutting down")
}

//Start HTTP server to handle API endpoints.
func Start(cfg Config) *HTMLServer {

	router := mux.NewRouter()

	// Create the HTML Server
	htmlServer := HTMLServer{
		server: &http.Server{
			Addr:           cfg.Host,
			Handler:        router,
			MaxHeaderBytes: 1 << 20,
		},
	}
	//liveness check
	router.HandleFunc("/ping", healthCheckHandler)

	//Get COVID-19 cases for specified country.
	router.HandleFunc("/v1/{cntr}", covidHandler)
	//Get all COVID-19 cases
	router.HandleFunc("/v1", covidHandler)

	router.PathPrefix("/assets").Handler(http.StripPrefix("/assets", http.FileServer(http.Dir("web/assets"))))
	router.HandleFunc("/", homeHandler)
	router.HandleFunc("/sitemap.xml", sitemapHandler)

	// Add to the WaitGroup for the listener goroutine
	htmlServer.wg.Add(1)

	go func() {
		fmt.Printf("\nCOVID-19 Service : started : Host=%v\n", htmlServer.server.Addr)
		htmlServer.server.ListenAndServe()
		htmlServer.wg.Done()
	}()
	return &htmlServer
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "web/index.html")
}

func sitemapHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "web/sitemap.xml")
}

//Stop HTTP server.
func (htmlServer *HTMLServer) Stop() error {
	// Create a context to attempt a graceful 5 second shutdown.
	const timeout = 5 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	fmt.Printf("\nCOVID-19 Service : stopping\n")

	// Attempt the graceful shutdown by closing the listener
	// and completing all inflight requests
	if err := htmlServer.server.Shutdown(ctx); err != nil {
		// Looks like we timed out on the graceful shutdown. Force close.
		if err := htmlServer.server.Close(); err != nil {
			fmt.Printf("\nCOVID-19 Service :  stopping : Error=%v\n", err)
			return err
		}
	}
	// Wait for the listener to report that it is closed.
	htmlServer.wg.Wait()
	fmt.Printf("\nCOVID-19 Service : Stopped\n")
	return nil
}

// runScheduler launches updateCovidStat func to pull
// updated information periodically (every hour)
func runScheduler(done chan struct{}) {
	gocron.Every(1).Hour().From(gocron.NextTick()).Do(updateCovidStat)
	for {
		select {
		case <-gocron.Start():
		case <-done:
			fmt.Println("Scheduler: Stopped")
			return
		}
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	io.WriteString(w, `{"alive":true}`)
}

// covidHandler handles API /v1 and /v1/{cntr} endpoints
// covidStatistics variable is parsed here according to
// passed {cntr} parameter
func covidHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		return
	}

	if covidStatistics == nil || len(covidStatistics) == 0 {
		http.Error(w, "Currently statistic is unavalialbe. Try later", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	country, ok := vars["cntr"]
	//return results for all coutries
	if !ok {
		writeResponse(w, covidStatistics)
		return
	}

	//return results for specified country
	countryStatistic := map[string]string{}
	for _, countryStatistic = range covidStatistics {
		if strings.ToLower(countryStatistic["Country_text"]) == strings.ToLower(country) {
			countryStatistic["Last Update"] = covidStatistics[len(covidStatistics)-1]["Last Update"]
			writeResponse(w, countryStatistic)
			return
		}
	}

	//If specifid country not found return the very first result (world)
	fmt.Println("Not Found")
	countryStatistic = covidStatistics[0]
	countryStatistic["Last Update"] = covidStatistics[len(covidStatistics)-1]["Last Update"]
	writeResponse(w, countryStatistic)

}

// updateCovidStat - send requests to DFK API
// Then DFK API pulls an actual COVID-19 data to covidStatistics map
func updateCovidStat() {
	//Load Payload to request live stats from worldometers.info
	payload, err := ioutil.ReadFile(*payloadFilePath)
	if err != nil {
		fmt.Printf("An error occure during reading payload file: %s", err.Error())
		return
	}
	//Send POST request to Dataflowkit Scraping API.
	response, err := http.Post(*dfkParseAPIServer+*apiKey, "application/json", bytes.NewReader(payload))
	if err != nil {
		fmt.Printf("Failed to post request to DFK Scraper API: %s", err.Error())
		return
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		body, err := ioutil.ReadAll(response.Body)
		if err != nil {
			fmt.Printf("Failed to read respose body: %s", err.Error())
			return
		}
		fmt.Printf("Failed to get COVID-19 statistics. Server returned: %s", string(body))
		return
	}
	//StatusOk
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		fmt.Printf("Failed read response body: %s", err.Error())
		return
	}
	err = json.Unmarshal(body, &covidStatistics)
	if err != nil {
		fmt.Printf("Failed unmarshal response into map: %s", err.Error())
		return
	}
	covidStatistics = append(covidStatistics, map[string]string{"Last Update": time.Now().Format("2006-01-02 15:04")})
}

func writeResponse(w http.ResponseWriter, countryStatistic interface{}) {
	buff, err := json.Marshal(countryStatistic)
	if err != nil {
		fmt.Printf("Failed to marshal corona: %s", err.Error())
		http.Error(w, "Failed to retrieve COVID-19 info", http.StatusInternalServerError)
		return
	}
	_, err = io.WriteString(w, string(buff))
	if err != nil {
		fmt.Printf("Failed to write response: %s", err.Error())
		http.Error(w, "Failed to retrieve COVID-19 info", http.StatusInternalServerError)
		return
	}
	return
}
