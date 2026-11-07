import SwiftUI
import UIKit
import WebKit

/// What the deck screen shows: a PC's deck, or the bundled demo.
struct DeckTarget: Equatable, Identifiable {
    let id = UUID()
    let url: URL
    let title: String
}

/// The deck, full screen in a WKWebView. It's the same page Safari gets from the PC; the
/// app adds haptics, keeps the screen on and goes back to the list of PCs when the PC
/// can't be reached or the player taps Switch PC.
struct DeckView: UIViewRepresentable {
    let target: DeckTarget
    /// nil when the player asked to switch PCs; otherwise why the deck couldn't load.
    let onLeave: (String?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(target: target, onLeave: onLeave)
    }

    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: Bridge.script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.add(WeakMessageHandler(context.coordinator), name: Bridge.handlerName)

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.setURLSchemeHandler(DemoSchemeHandler(), forURLScheme: DemoScheme.scheme)
        config.allowsInlineMediaPlayback = true
        // Button sounds start from a tap anyway; this keeps the first one from being dropped.
        config.mediaTypesRequiringUserActionForPlayback = []
        config.dataDetectorTypes = []
        config.applicationNameForUserAgent = "SpoolUpiOS/\(Bundle.main.shortVersion)"

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(Palette.background)
        web.scrollView.backgroundColor = UIColor(Palette.background)
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        context.coordinator.load(in: web)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        coordinator.stop()
        web.stopLoading()
        web.configuration.userContentController.removeScriptMessageHandler(forName: Bridge.handlerName)
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let target: DeckTarget
        private let onLeave: (String?) -> Void
        private let haptics = Haptics()
        private var loaded = false
        private var left = false
        private var watchdog: Task<Void, Never>?

        init(target: DeckTarget, onLeave: @escaping (String?) -> Void) {
            self.target = target
            self.onLeave = onLeave
        }

        func load(in web: WKWebView) {
            web.load(URLRequest(url: target.url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12))
            // A PC that's off or asleep often just never answers; don't sit on a blank screen.
            watchdog = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                guard let self = self, !Task.isCancelled, !self.loaded else { return }
                self.leave(NSLocalizedString("The PC didn't answer. Is SpoolUp running on it, on the same network?", comment: ""))
            }
        }

        func stop() {
            watchdog?.cancel()
            left = true
        }

        private func leave(_ reason: String?) {
            guard !left else { return }
            left = true
            watchdog?.cancel()
            onLeave(reason)
        }

        /// The PC's own pages (same host and port), and the bundled demo.
        private func isHome(_ url: URL?) -> Bool {
            guard let url = url else { return false }
            if DemoScheme.isDemo(target.url) { return DemoScheme.isDemo(url) }
            return url.scheme == "http" && url.host == target.url.host && (url.port ?? 80) == (target.url.port ?? 80)
        }

        // MARK: WKScriptMessageHandler

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, isHome(message.frameInfo.request.url) || isHome(message.webView?.url),
                  let msg = Bridge.read(message.body) else { return }
            switch msg {
            case .haptic(let kind): haptics.play(kind)
            case .switchPC: leave(nil)
            }
        }

        // MARK: WKNavigationDelegate

        func webView(_ web: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            // Frames inside the deck and about:blank stay as they are.
            if action.targetFrame?.isMainFrame == false || url.scheme == "about" || isHome(url) {
                return decisionHandler(.allow)
            }
            // Anything else (the GitHub feedback link) opens in Safari, never inside the app.
            if url.scheme == "https" || url.scheme == "http" { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }

        func webView(_ web: WKWebView, didFinish navigation: WKNavigation!) {
            loaded = true
            watchdog?.cancel()
        }

        func webView(_ web: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            failed(error)
        }

        func webView(_ web: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            failed(error)
        }

        private func failed(_ error: Error) {
            let code = (error as NSError).code
            // A canceled load (one we turned away above, or a reload) isn't a failure.
            if code == NSURLErrorCancelled || code == 102 /* WebKitErrorFrameLoadInterruptedByPolicyChange */ { return }
            // Once the deck is up it shows its own "not connected" state and reconnects by itself.
            if loaded { return }
            leave(String(format: NSLocalizedString("Couldn't open the deck: %@", comment: ""), error.localizedDescription))
        }

        func webViewWebContentProcessDidTerminate(_ web: WKWebView) {
            // iOS can end the page's process under memory pressure; bring the deck back.
            web.reload()
        }

        // MARK: WKUIDelegate

        func webView(_ web: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // target="_blank" links: Safari, never a second web view.
            if let url = action.request.url, url.scheme == "https" || url.scheme == "http" {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}

extension Bundle {
    var shortVersion: String { object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0" }
}
