# Coronavirus (COVID-19) open Go API

![alt tag](https://github.com/slotix/COVID-19/raw/master/img/COVID-19.png)
This API grabs live statistics from  https://www.worldometers.info/coronavirus/#countries web site periodically. 

It uses [Dataflow Kit API](https://dataflowkit.com) to scrape source web site. 


## Endpoints

`GET /v1` - List all COVID-19 cases per country.

`GET /v1/{cntr}` - Return COVID-19 cases for specified country. 

- If no `{cntr}` parameter specified the full dataset will be returned.
- Specify `{cntr}` parameter to extract results *for this country only*.
- Specify *world* as `{cntr}` parameter to extract summary results *for the whole world.*

Examples:

`https://covid-19.dataflowkit.com/v1/world` - summary results for the whole world.

`https://covid-19.dataflowkit.com/v1/spain` -  COVID-19 cases for Spain.

`https://covid-19.dataflowkit.com/v1/usa` -  COVID-19 cases for the USA.


## Installation

Clone public repository from github

```bash
git clone https://github.com/slotix/COVID-19.git
```

Run the following command to build Go binary

```bash
cd COVID-19/covid-19-service && go build
```

Register at [https://account.dataflowkit.com](https://account.dataflowkit.com/) to get Free API Key. 

## Start API Server

Now start the service and try to send requests.

```bash
./covid-19-service -a DFK-API-KEY
```

Type a command in another terminal :

```bash
curl 0.0.0.0:8008/v1/world
```

Or open  http://0.0.0.0:8008/v1 in your browser. 

## Dataflow Kit public COVID-19 Free API

https://covid-19.dataflowkit.com/v1

https://covid-19.dataflowkit.com/v1/world


## Widgets (Informers).

Free Coronavirus (COVID-19) widgets are available at: 

https://covid-19.dataflowkit.com

Your website visitor's country is determined automatically.


