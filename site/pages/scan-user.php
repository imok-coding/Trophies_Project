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

function dispatch_psn_scan(string $psnName): void {
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
      'psn_name' => $psnName,
      'npwrs' => ''
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
$psnName = trim((string)($_POST['psn_name'] ?? ''));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!preg_match('/^[A-Za-z0-9_-]{3,16}$/', $psnName)) {
    $error = 'Enter a valid PSN name.';
  } else {
    try {
      dispatch_psn_scan($psnName);
      $message = "Started GitHub scan for {$psnName}. Results will appear after the workflow finishes.";
    } catch (Throwable $e) {
      $error = $e->getMessage();
    }
  }
}

render_header('Scan PSN Account');
?>
<div class="max-w-2xl">
  <h1 class="text-2xl font-semibold mb-4">Scan PSN account</h1>

  <?php if ($message !== ''): ?>
    <div class="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
      <?= htmlspecialchars($message) ?>
    </div>
  <?php endif; ?>

  <?php if ($error !== ''): ?>
    <div class="mb-4 rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
      <?= htmlspecialchars($error) ?>
    </div>
  <?php endif; ?>

  <form method="post" class="flex flex-col gap-3 sm:flex-row">
    <input
      name="psn_name"
      value="<?= htmlspecialchars($psnName) ?>"
      placeholder="PSN account name"
      class="min-w-0 flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 outline-none focus:border-blue-500"
      required
    />
    <button class="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500">
      Start scan
    </button>
  </form>
</div>
<?php render_footer(); ?>
