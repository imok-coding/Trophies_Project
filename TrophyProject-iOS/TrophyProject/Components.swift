import SwiftUI

struct AppBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(colors: [Color(red: 0.03, green: 0.04, blue: 0.07), Color(red: 0.05, green: 0.07, blue: 0.12)], startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()
            )
    }
}

extension View {
    func appBackground() -> some View { modifier(AppBackground()) }
}

struct RemoteIcon: View {
    let url: String
    var size: CGFloat = 58

    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            default:
                Image(systemName: "trophy.fill").font(.title2).foregroundStyle(.cyan)
            }
        }
        .frame(width: size, height: size)
        .padding(4)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.09)))
    }
}

struct TrophyCountsView: View {
    let counts: TrophyCounts
    var body: some View {
        HStack(spacing: 10) {
            count(counts.platinum, "rosette", .cyan)
            count(counts.gold, "trophy.fill", .yellow)
            count(counts.silver, "trophy.fill", .gray)
            count(counts.bronze, "trophy.fill", .orange)
        }
        .font(.caption.weight(.semibold))
    }

    private func count(_ value: Int, _ symbol: String, _ color: Color) -> some View {
        HStack(spacing: 3) {
            Text(value.formatted())
            Image(systemName: symbol).foregroundStyle(color)
        }
    }
}

struct GameRow: View {
    let game: GameSummary
    var body: some View {
        HStack(spacing: 12) {
            RemoteIcon(url: game.iconUrl)
            VStack(alignment: .leading, spacing: 6) {
                Text(game.title).font(.headline).lineLimit(1)
                HStack {
                    Text(game.npwr).font(.caption.monospaced()).padding(.horizontal, 6).padding(.vertical, 3).background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 6))
                    Text(game.platform).font(.caption).foregroundStyle(.secondary)
                    Text("\(game.counts.total.formatted()) trophies").font(.caption).foregroundStyle(.secondary)
                }
                TrophyCountsView(counts: game.counts)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct SearchField: View {
    let placeholder: String
    @Binding var text: String
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(12)
        .background(.white.opacity(0.075), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.08)))
    }
}
