import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { MAP_COLOR, TILE_URL, type MapPoint } from "./live-map/shared";

/**
 * A map that runs everywhere the app does, Expo Go included: Leaflet inside a
 * WebView. MapLibre needs a native module Expo Go does not ship, so this is
 * what the site map, the supervisors' live map and the duty screen (in Expo Go)
 * draw with.
 *
 * The page is written once; what it shows is pushed in as JSON whenever the
 * props change, so a moving dot does not reload the map.
 */

export type MapFence = { id: string; name: string; ring: [number, number][]; tone: string };
export type MapPerson = MapPoint & { id: string; label?: string; tone: string };

export type MapCanvasProps = {
  fences?: MapFence[];
  people?: MapPerson[];
  me?: (MapPoint & { accuracyM?: number }) | null;
  /** A dashed line, from the guard to where they are heading. */
  route?: [MapPoint, MapPoint] | null;
  /** Changed to re-frame the view around everything drawn. */
  frameKey?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  style?: ViewStyle;
};

const FALLBACK_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#m{margin:0;height:100%;background:#eef0ee}
.leaflet-tile-pane{filter:saturate(.45) brightness(1.04)}
.me{position:relative;width:64px;height:64px}
.me i{position:absolute;inset:0;border-radius:50%;background:${MAP_COLOR.me};animation:p 1.8s ease-out infinite}
.me b{position:absolute;left:22px;top:22px;width:20px;height:20px;border-radius:50%;background:${MAP_COLOR.me};border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 4px #0004}
@keyframes p{from{transform:scale(.4);opacity:.45}to{transform:scale(1);opacity:0}}
.pin{display:flex;flex-direction:column;align-items:center;font:600 12px/16px system-ui,sans-serif}
.pin span{max-width:180px;padding:5px 11px;border-radius:999px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px #0003}
.pin s{width:3px;height:12px}
.pin u{width:11px;height:11px;border-radius:50%;border:3px solid;background:#fff;margin-top:-2px;box-sizing:border-box}
.who{display:flex;flex-direction:column;align-items:center;font:600 11px/14px system-ui,sans-serif}
.who b{width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 4px #0005}
.who span{margin-top:3px;padding:1px 6px;border-radius:6px;background:#fffe;color:#111;white-space:nowrap;box-shadow:0 1px 3px #0002}
.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return '&#'+c.charCodeAt(0)+';'})};
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([26.14,91.74],13);
map.attributionControl.setPrefix(false);
var tiles=L.tileLayer(__TILES__,{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var fellBack=false;
tiles.on('tileerror',function(){if(fellBack)return;fellBack=true;tiles.setUrl(__FALLBACK__)});
var group=L.layerGroup().addTo(map);
var lastFrame=null;
window.nbss=function(d){
  group.clearLayers();
  var pts=[];
  (d.fences||[]).forEach(function(f){
    var ring=f.ring.map(function(p){pts.push([p[1],p[0]]);return [p[1],p[0]]});
    L.polygon(ring,{color:f.tone,weight:2.5,fillColor:f.tone,fillOpacity:.14,smoothFactor:0}).addTo(group);
    var c=L.polygon(ring).getBounds().getCenter();
    L.marker(c,{interactive:false,icon:L.divIcon({className:'',html:'<div class="pin"><span style="background:'+f.tone+'">'+esc(f.name)+'</span><s style="background:'+f.tone+'"></s><u style="border-color:'+f.tone+'"></u></div>',iconSize:[180,46],iconAnchor:[90,44]})}).addTo(group);
  });
  if(d.route){L.polyline([[d.route[0].lat,d.route[0].lng],[d.route[1].lat,d.route[1].lng]],{color:'${MAP_COLOR.route}',weight:3,dashArray:'1 8',lineCap:'round'}).addTo(group)}
  (d.people||[]).forEach(function(p){
    pts.push([p.lat,p.lng]);
    L.marker([p.lat,p.lng],{interactive:false,icon:L.divIcon({className:'',html:'<div class="who"><b style="background:'+p.tone+'"></b>'+(p.label?'<span>'+esc(p.label)+'</span>':'')+'</div>',iconSize:[120,40],iconAnchor:[60,8]})}).addTo(group);
  });
  if(d.me){
    pts.push([d.me.lat,d.me.lng]);
    if(d.me.accuracyM&&d.me.accuracyM<500)L.circle([d.me.lat,d.me.lng],{radius:d.me.accuracyM,stroke:false,fillColor:'${MAP_COLOR.me}',fillOpacity:.08,interactive:false}).addTo(group);
    L.marker([d.me.lat,d.me.lng],{interactive:false,zIndexOffset:1000,icon:L.divIcon({className:'',html:'<div class="me"><i></i><b></b></div>',iconSize:[64,64],iconAnchor:[32,32]})}).addTo(group);
  }
  if(d.frameKey!==lastFrame&&pts.length){
    var pad=d.padding||{top:40,right:40,bottom:40,left:40};
    if(pts.length===1)map.setView(pts[0],17,{animate:lastFrame!==null});
    else map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[pad.left,pad.top],paddingBottomRight:[pad.right,pad.bottom],maxZoom:18,animate:lastFrame!==null});
    lastFrame=d.frameKey;
  }
};
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ready');
</script></body></html>`;

export function MapCanvas({ fences = [], people = [], me = null, route = null, frameKey = "", padding, style }: MapCanvasProps) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => HTML.replace("__TILES__", JSON.stringify(TILE_URL)).replace("__FALLBACK__", JSON.stringify(FALLBACK_TILES)),
    [],
  );

  // The frame key carries whether anything has been drawn yet, so the first fix or
  // the first fence frames the view once and later updates leave the guard's pan alone.
  const drawn = fences.length > 0 || people.length > 0 || me !== null;
  const payload = JSON.stringify({ fences, people, me, route, padding, frameKey: drawn ? `${frameKey}|${me ? 1 : 0}` : null });

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.nbss&&window.nbss(${payload});true;`);
  }, [ready, payload]);

  return (
    <View style={[styles.fill, style]}>
      <WebView
        ref={web}
        source={{ html, baseUrl: "https://nbss.local/" }}
        originWhitelist={["*"]}
        onMessage={(e) => {
          if (e.nativeEvent.data === "ready") setReady(true);
        }}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        // The console's tile proxy is plain http on the LAN while developing.
        mixedContentMode="always"
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#eef0ee", overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
