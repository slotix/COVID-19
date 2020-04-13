var CoronaWidget = (function () {
    var XHR = ("onload" in new XMLHttpRequest()) ? XMLHttpRequest : XDomainRequest;

    function Widget() {
        this.url = 'http://0.0.0.0:8008/v1';
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

        this.init();
    }

    Widget.prototype._updateData = function (e) {
        e && e.preventDefault();
        var xhr = new XHR(),
            cntr = this.ui.country,
            tot_cases = this.ui.tot_cases,
            new_cases = this.ui.new_cases,
            tot_deaths = this.ui.tot_deaths,
            new_deaths = this.ui.new_deaths,
            tot_recovered = this.ui.tot_recovered,
            active_cases = this.ui.active_cases,
            updateDate = this.ui.updateDate,
            resp;

        xhr.timeout = 3000;

        xhr.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    resp = JSON.parse(this.responseText);
                    cntr.innerHTML = resp['Country_text'] === ''? '0': resp['Country_text'];
                    tot_cases.innerHTML = resp['Total Cases_text'] === '' ? '0' : resp['Total Cases_text'];
                    new_cases.innerHTML = resp['New Cases_text'] === '' ? '0' : resp['New Cases_text'];
                    tot_deaths.innerHTML = resp['Total Deaths_text'] === '' ? '0' : resp['Total Deaths_text'];
                    new_deaths.innerHTML = resp['New Deaths_text'] === '' ? '0' : resp['New Deaths_text'];
                    tot_recovered.innerHTML = resp['Total Recovered_text'] === '' ? '0' : resp['Total Recovered_text'];
                    active_cases.innerHTML = resp['Active Cases_text'] === '' ? '0' : resp['Active Cases_text'];
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

        if (cntr.innerHTML !== '') {
            this.url += '/' + cntr.innerHTML;
        } 
        xhr.open('GET', this.url, true);
        xhr.send();
    }

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

    Widget.prototype.__initCountry = function () {
        return new Promise((resolve, reject) => {
            var xhr = new XHR();
            xhr.timeout = 3000;
            xhr.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        resp = JSON.parse(this.responseText);
                        resolve(resp.countryCode)
                    } else {
                        reject(xhr.status)
                    }
                }

            }
            xhr.ontimeout = function () {
                reject('timeout')
            }

            xhr.open('GET', 'http://ip-api.com/json', true);
            xhr.send();
        });

    }

    Widget.prototype.init = function () {
        this._initUI();
        this.__initCountry().then((countryCode) => {
            if (countryCode == 'US') {
                this.ui.country.innerHTML = 'USA';
            } else {
                this.ui.country.innerHTML = countryList[countryCode];
            }
            this._updateData();
        }).catch((err) => {
            console.log(err);
            this._updateData();
        });
    }
    return Widget;
})();

new CoronaWidget();