<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/layout.php';

function github_config(string $name, string $fallback = ''): string {
  $value = optional_config_value($name, $fallback);
  if ($value === '') {
    throw new RuntimeException("Missing config {$name}");
  }
  return $value;
}

function dispatch_npwr_scan(string $npwrs): void {
  $owner = github_config('GITHUB_OWNER', 'imok-coding');
  $repo = github_config('GITHUB_REPO', 'Trophies_Project');
  $workflow = github_config('GITHUB_WORKFLOW', 'scan.yml');
  $ref = github_config('GITHUB_REF', 'main');
  $token = github_config('GITHUB_TOKEN');

  $url = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) .
    '/actions/workflows/' . rawurlencode($workflow) . '/dispatches';

  $body = json_encode([
    'ref' => $ref,
    'inputs' => [
      'npwrs' => $npwrs
    ]
  ]);

  $headers = [
    'Accept: application/vnd.github+json',
    'Authorization: Bearer ' . $token,
    'Content-Type: application/json',
    'User-Agent: TrophyScanner',
    'X-GitHub-Api-Version: 2022-11-28'
  ];

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => $headers,
      CURLOPT_POSTFIELDS => $body,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HEADER => true
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $status < 200 || $status >= 300) {
      throw new RuntimeException($error ?: "GitHub dispatch failed with HTTP {$status}");
    }
    return;
  }

  $context = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => implode("\r\n", $headers),
      'content' => $body,
      'ignore_errors' => true
    ]
  ]);
  $response = file_get_contents($url, false, $context);
  $statusLine = $http_response_header[0] ?? '';

  if ($response === false || !preg_match('/^HTTP\/\S+\s+2\d\d\b/', $statusLine)) {
    throw new RuntimeException("GitHub dispatch failed: {$statusLine}");
  }
}

$message = '';
$error = '';
$npwrs = trim((string)($_POST['npwrs'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $items = preg_split('/[\s,]+/', $npwrs, -1, PREG_SPLIT_NO_EMPTY);
  $invalid = array_filter($items, fn($item) => !preg_match('/^NPWR\d{5}_00$/i', $item));

  if (!$items || $invalid) {
    $error = 'Enter one or more NPWR IDs, like NPWR00002_00.';
  } else {
    try {
      $clean = implode(',', array_map('strtoupper', $items));
      dispatch_npwr_scan($clean);
      $message = "Started GitHub scan for {$clean}.";
    } catch (Throwable $e) {
      $error = $e->getMessage();
    }
  }
}

render_header('Scan NPWR IDs');
?>
<section class="mx-auto max-w-2xl">
  <div class="ios-panel p-5 sm:p-6">
    <div class="mb-5">
      <div class="text-[13px] font-semibold uppercase tracking-wide text-[#007aff]">GitHub workflow</div>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight">Scan NPWR IDs</h1>
      <p class="mt-2 text-[15px] leading-6 ios-muted">
        Queue specific trophy IDs for an immediate scan.
      </p>
    </div>

    <?php if ($message !== ''): ?>
      <div class="mb-4 rounded-lg border border-[#34c759]/30 bg-[#ecfdf3] px-4 py-3 text-sm font-medium text-[#176b32]">
        <?= htmlspecialchars($message) ?>
      </div>
    <?php endif; ?>

    <?php if ($error !== ''): ?>
      <div class="mb-4 rounded-lg border border-[#ff3b30]/30 bg-[#fff1f0] px-4 py-3 text-sm font-medium text-[#9f1c16]">
        <?= htmlspecialchars($error) ?>
      </div>
    <?php endif; ?>

    <form method="post" class="space-y-3">
      <textarea
        name="npwrs"
        rows="4"
        placeholder="NPWR00002_00, NPWR00032_00"
        class="w-full resize-y rounded-lg border border-transparent bg-[#eef0f4] px-4 py-3 text-[15px] outline-none transition focus:border-[#007aff]/30 focus:bg-white focus:ring-4 focus:ring-[#007aff]/10"
        required
      ><?= htmlspecialchars($npwrs) ?></textarea>
      <button class="w-full rounded-full bg-[#007aff] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(0,122,255,0.25)] transition hover:bg-[#006ee6] sm:w-auto">
        Start scan
      </button>
    </form>
  </div>
</section>
<?php render_footer(); ?>
