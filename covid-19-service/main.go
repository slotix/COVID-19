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
	payloadFilePath   = "coronaPayload.json"
	dfkParseAPIServer = flag.String("p", "https://api.dataflowkit.com/v1/parse?api_key=", "DFK API Server address")
	apiKey            = flag.String("a", "15193b29b58de6b74ef8c8040adc6a2692975d26dc3b9198f4d7ed7ae6fc23e8", "DFK API Key")
	coronaState       []map[string]string
)

func init() {
}

func main() {
	serverCfg := Config{
		Host: "0.0.0.0:8008",
	}
	htmlServer := Start(serverCfg)
	defer htmlServer.Stop()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)
	<-sigChan

	fmt.Println("Single process server : shutting down")
}

func Start(cfg Config) *HTMLServer {
	flag.Parse()

	_, cancel := context.WithCancel(context.Background())
	defer cancel()

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

	router.HandleFunc("/corona/{cntr}", coronaHandler)
	router.HandleFunc("/corona", coronaHandler)

	// Add to the WaitGroup for the listener goroutine
	htmlServer.wg.Add(1)

	go func() {
		gocron.Every(1).Hour().From(gocron.NextTick()).Do(updateCoronaStat)
		<-gocron.Start()
	}()

	go func() {
		fmt.Printf("\nDataflow Kit Single Process Server : started (HTTP) : Host=%v\n", htmlServer.server.Addr)
		htmlServer.server.ListenAndServe()
		htmlServer.wg.Done()
	}()
	return &htmlServer
}

func (htmlServer *HTMLServer) Stop() error {
	// Create a context to attempt a graceful 5 second shutdown.
	const timeout = 5 * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	fmt.Printf("\nDataflow Kit Single process Server : stopping\n")

	// Attempt the graceful shutdown by closing the listener
	// and completing all inflight requests
	if err := htmlServer.server.Shutdown(ctx); err != nil {
		// Looks like we timed out on the graceful shutdown. Force close.
		if err := htmlServer.server.Close(); err != nil {
			fmt.Printf("\nDataflow Kit Single process Server : stopping : Error=%v\n", err)
			return err
		}
	}
	// Wait for the listener to report that it is closed.
	htmlServer.wg.Wait()
	fmt.Printf("\nDataflow Kit Single Process Server : Stopped\n")
	return nil
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	io.WriteString(w, `{"alive":true}`)
}

func coronaHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		return
	}

	if coronaState == nil || len(coronaState) == 0 {
		fmt.Println("This shouldn't happen")
		http.Error(w, "Currently statistic is unavalialbe. Try later", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	country, ok := vars["cntr"]
	if !ok {
		country = "World"
	}

	covidStatisctic := map[string]string{}
	for _, covidStatisctic = range coronaState {
		if strings.ToLower(covidStatisctic["Country_text"]) == strings.ToLower(country) {
			writeResponse(w, covidStatisctic)
			return
		}
	}

	fmt.Println("Not Found")
	covidStatisctic = coronaState[0]
	writeResponse(w, covidStatisctic)
}

func updateCoronaStat() {
	payload, err := ioutil.ReadFile(payloadFilePath)
	if err != nil {
		fmt.Printf("An error occure during reading payload file: %s", err.Error())
		return
	}

	response, err := http.Post(*dfkParseAPIServer+*apiKey, "application/json", bytes.NewReader(payload))
	if err != nil {
		fmt.Printf("Post DFK API request failed: %s", err.Error())
		return
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		body, err := ioutil.ReadAll(response.Body)
		if err != nil {
			fmt.Printf("Failed to read respose body: %s", err.Error())
			return
		}
		fmt.Printf("Failed get corona virus state. Server returned: %s", string(body))
		return
	}
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		fmt.Printf("Failed read response body: %s", err.Error())
		return
	}
	err = json.Unmarshal(body, &coronaState)
	if err != nil {
		fmt.Printf("Failed unmarshal response into map: %s", err.Error())
		return
	}
}

func writeResponse(w http.ResponseWriter, covidStatisctic map[string]string) {
	buff, err := json.Marshal(covidStatisctic)
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
