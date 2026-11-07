import UIKit

/// The deck's haptics, played with the Taptic Engine. Kinds match the Android app's
/// (`window.SpoolUpApp.haptic(kind)`); unknown kinds are ignored.
///
/// iPhones have a Taptic Engine; iPads don't, so there these calls do nothing.
@MainActor
final class Haptics {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let selection = UISelectionFeedbackGenerator()
    private let notice = UINotificationFeedbackGenerator()

    init() {
        light.prepare()
        medium.prepare()
    }

    func play(_ kind: String) {
        switch kind {
        case "tick":
            selection.selectionChanged()
        case "tap":
            light.impactOccurred()
            light.prepare()
        case "press":
            medium.impactOccurred()
            medium.prepare()
        case "heavy":
            heavy.impactOccurred()
        case "error":
            notice.notificationOccurred(.error)
        default:
            break
        }
    }
}
