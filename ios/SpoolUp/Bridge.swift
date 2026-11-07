import Foundation
import WebKit

/// The deck's side of the app: `window.SpoolUpApp`, the same two calls the Android app
/// offers with a JavaScript interface. The deck checks for it before use (public/app.js), so
/// the browser deck never sees it.
///
/// - `haptic(kind)`: `tick`, `tap`, `press`, `heavy` or `error`.
/// - `switchPC()`: leaves the deck for the app's list of PCs.
enum Bridge {
    static let handlerName = "spoolUp"

    /// Runs before the deck's own scripts, in the top frame only.
    static let script = #"""
    (function () {
      var handlers = window.webkit && window.webkit.messageHandlers;
      var h = handlers && handlers.spoolUp;
      if (!h || window.SpoolUpApp) return;
      window.SpoolUpApp = Object.freeze({
        haptic: function (kind) { h.postMessage({ haptic: String(kind) }); },
        switchPC: function () { h.postMessage({ switchPC: true }); }
      });
    })();
    """#

    enum Message: Equatable {
        case haptic(String)
        case switchPC
    }

    static func read(_ body: Any) -> Message? {
        guard let dict = body as? [String: Any] else { return nil }
        if let kind = dict["haptic"] as? String, kind.count <= 16 { return .haptic(kind) }
        if dict["switchPC"] as? Bool == true { return .switchPC }
        return nil
    }
}

/// WKUserContentController keeps its handlers alive; this breaks the cycle back to the
/// coordinator that owns the web view.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
