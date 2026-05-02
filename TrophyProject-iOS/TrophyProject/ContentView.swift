import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
            GamesView()
                .tabItem { Label("Games", systemImage: "square.grid.2x2.fill") }
            PlannerView()
                .tabItem { Label("Planner", systemImage: "checklist") }
            PSNUserView()
                .tabItem { Label("PSN", systemImage: "person.crop.circle.fill") }
        }
        .tint(.cyan)
    }
}

struct HomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 14) {
                        Image(systemName: "trophy.fill")
                            .font(.largeTitle)
                            .foregroundStyle(.cyan)
                            .frame(width: 70, height: 70)
                            .background(.cyan.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Trophy Project").font(.largeTitle.bold())
                            Text("Search trophy lists, inspect DLC, plan your roadmap, and check PSN profiles.")
                                .foregroundStyle(.secondary)
                        }
                    }

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        NavigationLink(value: HomeRoute.games) { feature("All Games", "Live searchable library", "square.grid.2x2.fill") }
                        NavigationLink(value: HomeRoute.planner) { feature("Planner", "Build trophy plans", "checklist") }
                        NavigationLink(value: HomeRoute.psn) { feature("PSN Users", "Exact user lookup", "person.crop.circle.fill") }
                        Link(destination: URL(string: "https://trophyproject.pro")!) { feature("Website", "Open trophyproject.pro", "safari.fill") }
                    }
                }
                .padding()
            }
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .games: GamesView()
                case .planner: PlannerView()
                case .psn: PSNUserView()
                }
            }
            .navigationTitle("Trophy Project")
            .appBackground()
        }
    }

    private func feature(_ title: String, _ subtitle: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon).font(.title2).foregroundStyle(.cyan)
            Text(title).font(.headline).foregroundStyle(.white)
            Text(subtitle).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 18))
    }
}

enum HomeRoute: Hashable { case games, planner, psn }

struct GamesView: View {
    @State private var query = ""
    @State private var page = 1
    @State private var response: GamesResponse?
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                SearchField(placeholder: "Search game title or NPWR", text: $query)
                    .padding(.horizontal)
                if let response {
                    Text("\(response.total.formatted()) games - Page \(response.page.formatted()) of \(response.totalPages.formatted())")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                List {
                    ForEach(response?.games ?? []) { game in
                        NavigationLink { GameDetailView(npwr: game.npwr) } label: { GameRow(game: game) }
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                    if let response, response.totalPages > 1 {
                        HStack {
                            Button("Previous") { Task { await load(max(1, page - 1)) } }.disabled(response.page <= 1)
                            Spacer()
                            Button("Next") { Task { await load(min(response.totalPages, page + 1)) } }.disabled(response.page >= response.totalPages)
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .listStyle(.plain)
                .overlay {
                    if isLoading { ProgressView().controlSize(.large) }
                    if let error { Text(error).foregroundStyle(.red).padding() }
                }
            }
            .navigationTitle("All Games")
            .appBackground()
            .task { await load(1) }
            .onChange(of: query) { _, _ in
                Task {
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    await load(1)
                }
            }
        }
    }

    private func load(_ targetPage: Int) async {
        isLoading = true
        error = nil
        do {
            response = try await APIClient.shared.games(query: query, page: targetPage)
            page = response?.page ?? targetPage
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
