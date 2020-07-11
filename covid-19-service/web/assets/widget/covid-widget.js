// CoronaWidget object holds properties and methods for retrieving live statistics of COVID-19 cases.  
var CoronaWidget = (function () {
    var XHR = ("onload" in new XMLHttpRequest()) ? XMLHttpRequest : XDomainRequest;
    const countryCodeExpression = /loc=([\w]{2})/;

    //Widget constructor
    function Widget() {
        // URL of API server, which serves endpoints for getting live statistics
        this.url = 'https://covid-19.dataflowkit.com/v1';
        //this.url = 'http://0.0.0.0:8008/v1';
        this.ui = {
            mainContainer: null,
            country: null,
            tot_cases: null,
            new_cases: null,
            tot_deaths: null,
            new_deaths: null,
            tot_recovered: null,
            active_cases: null,
            updateDate: null
        };
        this.country = '';
        this.init();
    }
    // Send requests to COVID-19 API and parse results for a specific country.
    Widget.prototype._updateData = function (e) {
        e && e.preventDefault();
        var xhr = new XHR(),
            tot_cases = this.ui.tot_cases,
            new_cases = this.ui.new_cases,
            tot_deaths = this.ui.tot_deaths,
            new_deaths = this.ui.new_deaths,
            tot_recovered = this.ui.tot_recovered,
            active_cases = this.ui.active_cases,
            updateDate = this.ui.updateDate,
            country = this.country,
            resp;
        xhr.timeout = 3000;

        xhr.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    resp = JSON.parse(this.responseText);
                    if (tot_cases != null) {
                        tot_cases.innerHTML = resp['Total Cases_text'] === '' ? '0' : resp['Total Cases_text'];
                    }
                    if (new_cases != null) {
                        new_cases.innerHTML = resp['New Cases_text'] === '' ? '0' : resp['New Cases_text'];
                    }
                    if (tot_deaths != null) {
                        tot_deaths.innerHTML = resp['Total Deaths_text'] === '' ? '0' : resp['Total Deaths_text'];
                    }
                    if (new_deaths != null) {
                        new_deaths.innerHTML = resp['New Deaths_text'] === '' ? '0' : resp['New Deaths_text'];
                    }
                    if (tot_recovered != null) {
                        tot_recovered.innerHTML = resp['Total Recovered_text'] === '' ? '0' : resp['Total Recovered_text'];
                    }
                    if (active_cases != null) {
                        active_cases.innerHTML = resp['Active Cases_text'] === '' ? '0' : resp['Active Cases_text'];
                    }
                    updateDate.innerHTML = resp['Last Update'] === '' ? '' : resp['Last Update'];
                } else {
                    console.log(`Failed to retrieve COVID-19 statisctic. Server returned status ${this.status}: ${this.responseText}`);
                }
            }
        }

        xhr.ontimeout = function () {
            console.log('Failed to retrieve COVID-19 statisctic. Timeout');
        }

        xhr.onerror = function (e) {
            console.log('Failed to retrieve COVID-19 statisctic.');
        }

        if (country !== '') {
            this.url += '/' + country;
        }
        xhr.open('GET', this.url, true);
        xhr.send();
    }

    // _initUI associates Widget members with HTML DOM structure elements. 
    Widget.prototype._initUI = function () {
        this.ui.mainContainer = document.getElementById('container');
        this.ui.country = document.getElementById('country');
        this.ui.tot_cases = document.getElementById('tot-cases');
        this.ui.new_cases = document.getElementById('new-cases');
        this.ui.tot_deaths = document.getElementById('tot-deaths');
        this.ui.new_deaths = document.getElementById('new-deaths');
        this.ui.tot_recovered = document.getElementById('tot-recover');
        this.ui.active_cases = document.getElementById('active-cases');
        this.ui.updateDate = document.getElementById('update-date');
    }

    //automatic country determination.
    Widget.prototype.__initCountry = function () {
        return new Promise((resolve, reject) => {
            var xhr = new XHR();
            xhr.timeout = 3000;
            xhr.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        result = countryCodeExpression.exec(this.responseText)
                        if (result == null || result[1] === '') {
                            console.log('Failed determine country code');
                            resolve('world');
                        }
                        resolve(result[1])
                    } else {
                        reject(xhr.status)
                    }
                }
            }
            xhr.ontimeout = function () {
                reject('timeout')
            }
            xhr.open('GET', 'https://www.cloudflare.com/cdn-cgi/trace', true);
            xhr.send();
        });
    }

    Widget.prototype.init = function () {
        // _initUI associates Widget members with HTML DOM structure elements. 
        this._initUI();
        this.__initCountry().then((countryCode) => {
            flag = '<img class="flag-img" src="./flags/' + countryCode.toLowerCase() + '.svg" alt="' + countryList[countryCode] + '">';
            this.ui.country.innerHTML = flag + '&nbsp' + countryList[countryCode];
            this.country = countryList[countryCode];
            this._updateData();
        }).catch((err) => {
            console.log(err);
            this._updateData();
        });
    }
    return Widget;
})();

new CoronaWidget();

const countryCodeExpression = /loc=([\w]{2})/;
const userIPExpression = /ip=([\w\.]+)/;

//automatic country determination.
function initCountry() {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 3000;
        xhr.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    countryCode = countryCodeExpression.exec(this.responseText)
                    ip = userIPExpression.exec(this.responseText)
                    if (countryCode === null || countryCode[1] === '' ||
                        ip === null || ip[1] === '') {
                        reject('IP/Country code detection failed');
                    }
                    let result = {
                        "countryCode": countryCode[1],
                        "IP": ip[1]
                    };
                    resolve(result)
                } else {
                    reject(xhr.status)
                }
            }
        }
        xhr.ontimeout = function () {
            reject('timeout')
        }
        xhr.open('GET', 'https://www.cloudflare.com/cdn-cgi/trace', true);
        xhr.send();
    });
}