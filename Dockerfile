# Two stages: compile with the toolchain, ship without it. Everything the site
# needs — templates, CSS, JS, fonts, photographs — is embedded in the binary, so
# the runtime image carries one file plus a CA bundle.

FROM golang:1.24-alpine AS build
WORKDIR /src

# There are no third-party dependencies, but copying the module files first
# still gives a stable cache layer if any are added later.
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/nbss ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/nbss /app/nbss

# The submissions file is the only mutable state. Mount a volume here.
VOLUME ["/app/data"]

ENV NBSS_ADDR=:8080 \
    NBSS_DATA=/app/data/submissions.json

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/nbss"]
