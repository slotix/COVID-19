let flagList = countryList;

let CoronaTopWidget = (function () {
    let XHR = ("onload" in new XMLHttpRequest()) ? XMLHttpRequest : XDomainRequest;

    function Widget() {
        this.ui = {
            table: null,
            lastUpdate: "",
        };
        this.init();
    }


    Widget.prototype._updateData = function (countriesArray) {
        if (!this.ui.table) {
            return;
        }

        this.ui.table.innerHTML = "";

        /* Headers */
        for (let title of ["Country", "Total Cases", "Deaths", "Recovered", "Active Cases"]) {
            let header = document.createElement("div");
            header.className = "cell cell-header";
            header.innerText = title;
            this.ui.table.append(header);
        }

        /* Cells */
        for (let obj of countriesArray) {

            /* Country */
            let country = document.createElement("div");
            country.className = "cell country";
            let flag = document.createElement("img");
            flag.className = "country-flag";
            flag.src = flagList[obj["Country_text"]];
            country.append(flag, obj["Country_text"]);

            /* Cases */
            let cases = document.createElement("div");
            cases.className = "cell cases";
            let plus_cases = document.createElement("span");
            plus_cases.className = "plus-cases";
            plus_cases.innerText = obj["New Cases_text"];
            cases.append(obj["Total Cases_text"], plus_cases);

            /* Deaths */
            let deaths = document.createElement("div");
            deaths.className = "cell deaths";
            let plus_deaths = document.createElement("span");
            plus_deaths.className = "plus-deaths";
            plus_deaths.innerHTML = obj["New Deaths_text"];
            deaths.append(obj["Total Deaths_text"], plus_deaths);

            /* Recovered */
            let recovered = document.createElement("div");
            recovered.className = "cell recovered";
            recovered.innerHTML = obj["Total Recovered_text"];

            /* Active */
            let active = document.createElement("div");
            active.className = "cell active-cases";
            active.innerText = obj["Active Cases_text"];

            /* append */
            this.ui.table.append(country, cases, deaths, recovered, active);
        }

        /* Footer */
        let footer = document.createElement("div");
        footer.className = "cell cell-footer";
        footer.innerHTML = "Updated: " + this.ui.lastUpdate + `&nbsp;&nbsp;<div>Built with <a class="link-dfk" href="https://dataflowkit.com" target="blank">DataflowKit</a></div>`;
        this.ui.table.append(footer);
    }

    Widget.prototype._initUI = function () {
        this.ui.table = document.getElementsByClassName("table")[0];
    }

    // countriesAmount int. used to limit the results amount
    // sortDesc bool. if true then sort will be descending. false - ascending
    // sortField string. field of country's object which will be used for the sort
    Widget.prototype.__initTopCounties = function (countriesAmount, sortField, sortDesc) {
        var self = this;
        return new Promise((resolve, reject) => {
            let xhr = new XHR();
            xhr.timeout = 3000;
            xhr.ontimeout = function () {
                reject('timeout');
            }
            xhr.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        sortDesc ? sortDesc = -1 : sortDesc = 1;
                        var results = JSON.parse(this.responseText);
                        self.ui.lastUpdate = results[results.length - 1]['Last Update'];
                        results = results.filter((obj) => (obj[sortField]));

                        // sort results
                        results = results.sort((a, b) => {
                            var intA = parseInt(a[sortField].replace(/\D+/g, ""));
                            var intB = parseInt(b[sortField].replace(/\D+/g, ""));
                            if (intA === intB)
                                return 0;
                            if (intA > intB) {
                                return sortDesc;
                            } else {
                                return -1 * sortDesc;
                            }
                        });
                        results = results.slice(0, countriesAmount);
                        resolve(results);
                    } else {
                        reject(xhr.status);
                    }
                }
            }
            xhr.open('GET', 'https://covid-19.dataflowkit.com/v1', true);
            xhr.send();
        });
    }

    Widget.prototype.init = function () {
        flagList = Object.keys(countryList).reduce((obj, key) => {
            obj[countryList[key]] = "./flags/" + key.toLowerCase() + ".svg";
            return obj;
        }, {});
        flagList["World"] = "./flags/wo.svg";

        this._initUI();
        this.__initTopCounties(15, "Total Cases_text", true).then((topCountries) => {
            this._updateData(topCountries);
        }).catch((err) => {
            console.log("ERR:", err);
        });
    }
    return Widget;
})();

new CoronaTopWidget();