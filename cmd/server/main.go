// Command server runs the National Bodo Security Services website.
//
// The binary is self-contained: templates, stylesheets, scripts, fonts and
// photographs are embedded, so deployment is "copy one file and run it".
// Passing -dev switches to reading web/ from disk and re-parsing templates on
// every request.
package main

import (
	"context"
	"errors"
	"flag"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	nbss "github.com/nbss/website"
	"github.com/nbss/website/internal/store"
	"github.com/nbss/website/internal/web"
)

func main() {
	var (
		addr      = flag.String("addr", envOr("NBSS_ADDR", ":8080"), "host:port to listen on")
		dataFile  = flag.String("data", envOr("NBSS_DATA", "data/submissions.json"), "path to the submissions file")
		baseURL   = flag.String("base-url", envOr("NBSS_BASE_URL", "http://localhost:8080"), "public base URL, used for canonical links and the sitemap")
		adminUser = flag.String("admin-user", envOr("NBSS_ADMIN_USER", "admin"), "operations username")
		adminPass = flag.String("admin-pass", envOr("NBSS_ADMIN_PASS", "nbss-kokrajhar"), "operations password")
		dev       = flag.Bool("dev", os.Getenv("NBSS_DEV") == "1", "read web/ from disk and re-parse templates per request")
	)
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	assets, err := assetFS(*dev)
	if err != nil {
		log.Error("cannot open assets", "err", err)
		os.Exit(1)
	}

	st, err := store.Open(*dataFile)
	if err != nil {
		log.Error("cannot open data store", "path", *dataFile, "err", err)
		os.Exit(1)
	}

	srv, err := web.New(web.Config{
		Assets:    assets,
		Dev:       *dev,
		AdminUser: *adminUser,
		AdminPass: *adminPass,
		BaseURL:   *baseURL,
		Logger:    log,
	}, st)
	if err != nil {
		log.Error("cannot build server", "err", err)
		os.Exit(1)
	}

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	// Serve until SIGINT/SIGTERM, then drain in-flight requests.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info("nbss website listening",
			"addr", *addr, "dev", *dev, "data", *dataFile, "admin", "/admin")
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("listen failed", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	log.Info("stopped cleanly")
}

// assetFS returns the web/ tree, either embedded in the binary or from disk.
// Dev mode requires the process to be started from the repository root.
func assetFS(dev bool) (fs.FS, error) {
	if dev {
		if _, err := os.Stat("web/templates/layouts/base.html"); err != nil {
			return nil, errors.New("-dev needs to be run from the repository root (web/ not found here)")
		}
		return os.DirFS("web"), nil
	}
	return nbss.Assets()
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
