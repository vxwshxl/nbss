// Package nbss embeds the web/ asset tree — templates, stylesheets, scripts,
// fonts and photographs — into the binary.
//
// The directive lives at the module root because go:embed cannot reference a
// path above its own directory, and web/ sits alongside cmd/ and internal/.
package nbss

import (
	"embed"
	"io/fs"
)

//go:embed all:web
var embedded embed.FS

// Assets returns the web/ tree as a filesystem rooted at web/, so callers see
// "templates/..." and "static/..." rather than "web/templates/...".
func Assets() (fs.FS, error) {
	return fs.Sub(embedded, "web")
}
