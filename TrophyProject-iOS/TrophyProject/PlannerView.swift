import SwiftUI

struct PlannerView: View {
    @State private var query = ""
    @State private var results: [GameSummary] = []
    @State private var titles: [PlannerTitle] = PlannerStore.load()
    @State private var error: String?

    private var selectedCount: Int { titles.reduce(0) { $0 + $1.selectedIds.count } }
    private var points: Int {
        titles.reduce(0) { sum, title in
            sum + title.trophies.filter { title.selectedIds.contains($0.id) }.reduce(0) { $0 + trophyPoints($1.type) }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        stat("Titles", titles.count)
                        stat("Trophies", selectedCount)
                        stat("Points", points)
                    }

                    SearchField(placeholder: "Add a trophy list", text: $query)
                    ForEach(results) { game in
                        Button { Task { await add(game.npwr) } } label: {
                            HStack {
                                GameRow(game: game)
                                Text(titles.contains(where: { $0.npwr == game.npwr }) ? "Added" : "Add")
                                    .font(.caption.bold())
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 7)
                                    .background(.cyan, in: Capsule())
                                    .foregroundStyle(.black)
                            }
                        }
                        .disabled(titles.contains(where: { $0.npwr == game.npwr }))
                    }

                    ForEach($titles) { $title in
                        DisclosureGroup {
                            ForEach(title.trophies) { trophy in
                                Toggle(isOn: Binding(
                                    get: { title.selectedIds.contains(trophy.id) },
                                    set: { enabled in
                                        if enabled { title.selectedIds = Array(Set(title.selectedIds + [trophy.id])) }
                                        else { title.selectedIds.removeAll { $0 == trophy.id } }
                                        PlannerStore.save(titles)
                                    }
                                )) {
                                    TrophyRow(trophy: trophy)
                                }
                            }
                        } label: {
                            HStack {
                                RemoteIcon(url: title.iconUrl, size: 54)
                                VStack(alignment: .leading) {
                                    Text(title.title).font(.headline)
                                    Text("\(title.selectedIds.count)/\(title.trophies.count) planned").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding()
                        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding()
            }
            .navigationTitle("Planner")
            .appBackground()
            .onChange(of: query) { _, value in Task { await search(value) } }
            .toolbar { Button("Clear") { titles = []; PlannerStore.save(titles) } }
        }
    }

    private func stat(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading) {
            Text(label).font(.caption.bold()).foregroundStyle(.secondary)
            Text(value.formatted()).font(.title3.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 16))
    }

    private func search(_ value: String) async {
        guard value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else { results = []; return }
        do { results = try await APIClient.shared.plannerSearch(query: value) }
        catch { self.error = error.localizedDescription }
    }

    private func add(_ npwr: String) async {
        guard titles.contains(where: { $0.npwr == npwr }) == false else { return }
        do {
            titles.append(try await APIClient.shared.plannerTitle(npwr: npwr))
            PlannerStore.save(titles)
        } catch { self.error = error.localizedDescription }
    }

    private func trophyPoints(_ type: String) -> Int {
        switch type {
        case "platinum": return 300
        case "gold": return 90
        case "silver": return 30
        default: return 15
        }
    }
}

enum PlannerStore {
    static let key = "plannedTitles"
    static func load() -> [PlannerTitle] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([PlannerTitle].self, from: data)) ?? []
    }
    static func save(_ titles: [PlannerTitle]) {
        UserDefaults.standard.set(try? JSONEncoder().encode(titles), forKey: key)
    }
}
