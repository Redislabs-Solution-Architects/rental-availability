# Redis Rental Availability Demo

## Contents
1.  [Summary](#summary)
2.  [Architecture](#architecture)
3.  [Approach](#approach)
4.  [Features](#features)
5.  [Prerequisites](#prerequisites)
6.  [Installation](#installation)
7.  [Usage](#usage)


## Summary <a name="summary"></a>
This is a Javascript-based demo of the Redis Search functionality in property rental domain.  Address data is obtained from a csv file and then supplemented with fictional availability date/time ranges.  

## Architecture <a name="architecture"></a>
![architecture](https://docs.google.com/drawings/d/e/2PACX-1vS_WgjjyIfcWUWU13wfYjTb9T7SwBP8SRp1AgkMxrEr8tmwSuRjxf4XDpsfxRYjazJs5p8xHw-zPH3U/pub?w=663&h=380)  

## Approach <a name="approach"></a>
### Data Structure
Availability time slots are gathered as local date/times in the GUI but converted to UNIX timestamps for storage in Redis.
#### Example 2-Hour Timeslot
```text
begin = 'Fri Aug 04 2023 00:00:00 GMT-0600 (Mountain Daylight Time)'
end =   'Fri Aug 04 2023 02:00:00 GMT-0600 (Mountain Daylight Time)'

becomes

begin = 1691128800
end = 1691136000
```
#### Example Property Object
```bash
> json.get property:79680 indent "\t" newline "\n" space " "
"{
	"id": 79680,
	"address": {
		"coords": "-108.5623269 39.0706605",
		"number": "608",
		"street": "Grand Avenue",
		"unit": "",
		"city": "GRAND JUNCTION",
		"state": "CO",
		"postcode": "81501"
	},
	"owner": {
		"fname": "Milli",
		"lname": "Jana"
	},
	"type": "auditorium",
	"availability": [
		{
			"begin": 1686740400,
			"end": 1686747600
		},
		{
			"begin": 1691078400,
			"end": 1691082000
		},
		{
			"begin": 1691283600,
			"end": 1691308800
		}
	],
	"rate": 306.1
}"
```
# Search Methodology
The GUI provides data inputs to allow for search criteria on:
 - Property type
 - Radius from a ZIP code.  Geographic coordinates for US ZIP codes are stored as Redis Strings.
 - Availability date/time slot (begin and end)
 ### Example Query (CLI)
 ```bash
> GET zip:81501
"-108.547131 39.071848"
 ```
 ```bash
> FT.AGGREGATE propIdx '@type:{court} @coords:[-108.547131 39.071848 30 mi]' LOAD 4 @__key '$.availability[?(@.begin<=1691128800 && @.end>=1691136000)]' AS match FILTER 'exists(@match)' SORTBY 2 @rate ASC limit 0 3 DIALECT 3
1) "11502"
2) 1) "__key"
   2) "property:45950"
   3) "match"
   4) "[{\"begin\":1691128800,\"end\":1691150400}]"
   5) "rate"
   6) "127.29"
3) 1) "__key"
   2) "property:57353"
   3) "match"
   4) "[{\"begin\":1691125200,\"end\":1691146800}]"
   5) "rate"
   6) "127.69"
4) 1) "__key"
   2) "property:92742"
   3) "match"
   4) "[{\"begin\":1691125200,\"end\":1691139600}]"
   5) "rate"
   6) "128.2"
 ```


## Features <a name="features"></a>
- ExpressJS-based REST API server, data loading functionality, and HTML GUI to demonstrate rental availability search.

## Prerequisites <a name="prerequisites"></a>
- Docker
- Docker Compose

## Installation <a name="installation"></a>
```bash
git clone https://github.com/Redislabs-Solution-Architects/rental-availability.git && cd rental-availability
```

## Usage <a name="usage"></a>
### Server start-up
```bash
docker compose up -d
```
### Server shutdown
```bash
docker compose down
```
### GUI Access
```bash
http://localhost:8000
```
### Sample GUI Screenshot
![gui](./assets/screenshot1.png)
### Sample Property Document in RedisInsight
![insight](./assets/screenshot2.png)


