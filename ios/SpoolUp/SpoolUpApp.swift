import SwiftUI
import UIKit

@main
struct SpoolUpApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environmentObject(model.saved)
                .environmentObject(model.discovery)
                .preferredColorScheme(.dark)
                .tint(Palette.accent)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            Palette.background.ignoresSafeArea()
            if let target = model.deck {
                DeckScreen(target: target)
                    .id(target.id)
            } else {
                HomeView()
            }
        }
    }
}

/// The deck, edge to edge, with the screen kept on while it's up.
struct DeckScreen: View {
    let target: DeckTarget
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        DeckView(target: target) { reason in model.leaveDeck(reason) }
            .ignoresSafeArea()
            .statusBarHidden(true)
            .persistentSystemOverlays(.hidden)
            .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
            .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
            .onChange(of: scenePhase) { phase in
                // iOS can reset this while the app is in the background.
                UIApplication.shared.isIdleTimerDisabled = phase == .active
            }
    }
}
