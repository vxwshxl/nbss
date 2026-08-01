BINARY := nbss
PKG    := ./cmd/server
PORT   ?= 8080

.DEFAULT_GOAL := help

## help: list the available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  make /'

## dev: run with live template reload (reads web/ from disk)
dev:
	NBSS_DEV=1 go run $(PKG) -addr :$(PORT) -dev

## run: run the embedded build (what production serves)
run:
	go run $(PKG) -addr :$(PORT)

## build: compile a single self-contained binary into ./bin
build:
	@mkdir -p bin
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/$(BINARY) $(PKG)
	@echo "built bin/$(BINARY) ($$(du -h bin/$(BINARY) | cut -f1))"

## build-linux: cross-compile a linux/amd64 binary for deployment
build-linux:
	@mkdir -p bin
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/$(BINARY)-linux-amd64 $(PKG)

## test: run the full test suite
test:
	go test ./...

## cover: run tests and open the coverage report
cover:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

## check: verify formatting, then vet and test
check:
	@test -z "$$(gofmt -l .)" || { echo "gofmt needed:"; gofmt -l .; exit 1; }
	go vet ./...
	go test ./...

## fmt: format all Go sources
fmt:
	gofmt -w .

## clean: remove build artefacts and local submission data
clean:
	rm -rf bin coverage.out data/submissions.json data/submissions.json.tmp

.PHONY: help dev run build build-linux test cover check fmt clean
