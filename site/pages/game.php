<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/layout.php';

$npwr = $_GET["npwr"] ?? "";
$db = db_connect();

$stmt = $db->prepare("SELECT * FROM games WHERE npwr=?");
$stmt->bind_param("s", $npwr);
$stmt->execute();
$game = $stmt->get_result()->fetch_assoc();
if (!$game) { http_response_code(404); exit("Not found"); }

render_header($game["title_name"]);
?>
<div class="flex gap-4 items-start">
  <div class="w-24 h-24 rounded-2xl bg-zinc-800 overflow-hidden">
    <?php if (!empty($game["icon_url"])): ?>
      <img src="<?= htmlspecialchars($game["icon_url"]) ?>" class="w-full h-full object-cover" />
    <?php endif; ?>
  </div>
  <div class="min-w-0">
    <h1 class="text-2xl font-semibold"><?= htmlspecialchars($game["title_name"]) ?></h1>
    <div class="text-sm text-zinc-400 mt-1">
      <?= htmlspecialchars($game["npwr"]) ?> • <?= htmlspecialchars($game["title_platform"]) ?>
    </div>

    <?php if (!empty($game["igdb_name"])): ?>
      <div class="text-sm text-zinc-300 mt-2">
        IGDB: <?= htmlspecialchars($game["igdb_name"]) ?>
        <?php if (!empty($game["first_release"])): ?>
          • Release: <?= htmlspecialchars($game["first_release"]) ?>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</div>

<hr class="my-6 border-zinc-800" />

<?php
$groups = $db->prepare("SELECT * FROM trophy_groups WHERE npwr=? ORDER BY group_id");
$groups->bind_param("s", $npwr);
$groups->execute();
$gr = $groups->get_result();
?>

<?php while ($g = $gr->fetch_assoc()): ?>
  <div class="mb-6">
    <div class="flex items-center justify-between">
      <div class="font-semibold">
        <?= htmlspecialchars($g["group_id"]) ?> — <?= htmlspecialchars($g["group_name"] ?: "Trophy Group") ?>
      </div>
    </div>

    <?php
      $t = $db->prepare("SELECT trophy_id, trophy_name, trophy_type, hidden, icon_url
                        FROM trophies WHERE npwr=? AND group_id=? ORDER BY trophy_id");
      $t->bind_param("ss", $npwr, $g["group_id"]);
      $t->execute();
      $tr = $t->get_result();
    ?>

    <div class="mt-3 space-y-2">
    <?php while ($row = $tr->fetch_assoc()): ?>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden">
          <?php if (!empty($row["icon_url"])): ?>
            <img src="<?= htmlspecialchars($row["icon_url"]) ?>" class="w-full h-full object-cover" />
          <?php endif; ?>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium truncate"><?= htmlspecialchars($row["trophy_name"]) ?></div>
          <div class="text-xs text-zinc-400">
            #<?= (int)$row["trophy_id"] ?> • <?= htmlspecialchars($row["trophy_type"]) ?>
            <?= ((int)$row["hidden"] === 1) ? " • Hidden" : "" ?>
          </div>
        </div>
      </div>
    <?php endwhile; ?>
    </div>
  </div>
<?php endwhile; ?>

<?php render_footer(); ?>