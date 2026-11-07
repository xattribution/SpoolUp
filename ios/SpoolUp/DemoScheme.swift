import Foundation
import WebKit

/// The offline demo: the deck bundled in the app (ios/Deck, copied by bundle-deck.js),
/// served from `spoolup-demo://deck/` so its relative fetches (`layouts/hud.json`) work the
/// way they do on the website's "Try it" page. Presses only play their animations; no PC is
/// needed and nothing leaves the device.
enum DemoScheme {
    static let scheme = "spoolup-demo"
    static let host = "deck"
    static let startURL = URL(string: "spoolup-demo://deck/index.html?demo")!

    static func isDemo(_ url: URL?) -> Bool { url?.scheme == scheme }
}

final class DemoSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL? = Bundle.main.url(forResource: "Deck", withExtension: nil)?.standardizedFileURL

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == DemoScheme.host, let root = root else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        // Stay inside the bundled folder whatever the path says.
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            respond(task, url: url, status: 404, type: "text/plain", data: Data("Not found".utf8))
            return
        }
        respond(task, url: url, status: 200, type: DemoSchemeHandler.mimeType(file.pathExtension), data: data)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Every response is sent at once in start, so there's nothing to stop.
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.badServerResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "woff2": return "font/woff2"
        case "wav": return "audio/wav"
        case "mp3": return "audio/mpeg"
        default: return "application/octet-stream"
        }
    }
}
