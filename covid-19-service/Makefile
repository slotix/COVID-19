APP?=covid-19-service
GOOS?=linux
GOARCH?=amd64
PORT?=8008
LATEST?=latest
COMMIT?=$(shell git rev-parse --short HEAD)
BUILD_TIME?=$(shell date -u '+%Y-%m-%d_%H:%M:%S')

clean:
	rm -f ${APP}

build: clean
	CGO_ENABLED=0 \
	GOOS=${GOOS} GOARCH=${GOARCH} \
	go build \
        -ldflags "-s -w -X main.Commit=${COMMIT} \
		-X main.BuildTime=${BUILD_TIME}" \
		-a \
        -o ${APP}
