/* ============================================================
 * sw.js — 离线支持（Service Worker）
 *
 * 策略（关键：不能让新增的 .md / .webp 被旧缓存挡住）
 *   · .md、页面导航   → 网络优先，失败才用缓存
 *                       新写的章节永远先拿最新的；断网时退回缓存
 *   · 其余静态资源    → 先用缓存，同时后台拉新
 *                       css/js/图片更新后，第二次打开就是新的
 *
 * 安装时会把「已完成的章节」一起预下载，所以第一次联网打开之后，
 * 整本书都能断网阅读；以后新增的章节不在清单里也没关系——联网看过
 * 一次就会被存下来，不会因为清单没更新而永远读不到。
 *
 * 改完 css/js 想立刻让老读者更新：把 CACHE 的版本号 +1 即可。
 * ============================================================ */
var CACHE = 'poke-trpg-v60';

// 外壳资源：缺一个都会导致界面错乱，所以用 addAll 强一致
var PRECACHE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/theme.css',
    './assets/app.js',
    './assets/type-data.js',
    './assets/favicon.svg',
    './assets/icons/icon-180.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './vendor/vue.css',
    './vendor/docsify.min.js',
    './vendor/sidebar-collapse.min.js',
    // 角色卡是独立页面，不缓存的话断网时点进侧栏就是一片空白
    './sheets.html',
    './assets/sheets.css',
    './assets/sheets.js'
];

// 正文内容：逐个下载，某一个还没上线（404）也照常安装，不影响其它章节
var PRE_MD = [
    './_sidebar.md',
    './README.md',
    './00-introduction.md',
    './01-marvelous-world.md',
    './02-system-explained.md',
    './03-character-creation.md',
    './04-pokemon-battles.md',
    './05-catching.md',
    './06-training.md',
    './typechart.md',
    './dice.md',
    './gm-screen.md',
    './icons.md',
    './itemprice.md',
    './appendix-glossary.md',
    './not-found.md',
    './assets/img/trainer-licence.webp',
    './assets/img/trainer-stats.webp',
    './assets/img/trainer-bag.webp',
    './assets/img/pokemon-dex.webp',
    './assets/img/pokemon-quickref.webp',
    './assets/img/pokemon-stats.webp',
    './assets/img/pokemon-social.webp',
    // 补充的精灵球（原作有、原书没收录，图标取自 52poke 的 ZA sprite）
    './assets/img/ball-heal.webp',
    './assets/img/ball-premier.webp',
    './assets/img/ball-repeat.webp',
    './assets/img/ball-timer.webp',
    './assets/img/ball-nest.webp',
    './assets/img/ball-net.webp',
    './assets/img/ball-dive.webp',
    './assets/img/ball-moon.webp',
    './assets/img/ball-friend.webp',
    './assets/img/ball-love.webp',
    './assets/img/ball-level.webp',
    './assets/img/ball-lure.webp',
    './assets/img/ball-safari.webp',
    './assets/img/ball-sport.webp',
    './assets/img/ball-park.webp',
    './assets/img/ball-dream.webp',
    // 洗翠（《传说 阿尔宙斯》）的球，_dev/fetch_balls_52poke.py 抓的 LA 版 sprite
    './assets/img/ball-feather.webp',
    './assets/img/ball-wing.webp',
    './assets/img/ball-jet.webp',
    './assets/img/ball-heavy-hisui.webp',
    './assets/img/ball-superheavy.webp',
    './assets/img/ball-gigaton.webp',
    './assets/img/ball-origin.webp',
    './assets/img/ball-strange.webp',
    // 骰面与联盟徽标（_dev/extract_system_art.py 生成，掷骰台 / 骰池 / 规则集海报用）
    './assets/img/die-1.webp',
    './assets/img/die-2.webp',
    './assets/img/die-3.webp',
    './assets/img/die-4.webp',
    './assets/img/die-5.webp',
    './assets/img/die-6.webp',
    './assets/img/league-mark.webp',
    './assets/img/icon-starter.webp',
    // 章节页脚插画（_dev/extract_scene_art.py 生成，每章结尾一张）
    './assets/img/scene-market.webp',
    './assets/img/scene-autumn.webp',
    './assets/img/scene-forest.webp',
    './assets/img/scene-town.webp',
    // 精灵球图标（05 章用到，_dev/extract_ball_icons.py 生成）
    './assets/img/ball-starter.webp',
    './assets/img/ball-poke.webp',
    './assets/img/ball-great.webp',
    './assets/img/ball-ultra.webp',
    './assets/img/ball-cherish.webp',
    './assets/img/ball-luxury.webp',
    './assets/img/ball-ub.webp',
    './assets/img/ball-dynamax.webp',
    './assets/img/ball-master.webp',
    // 道具册图标的补充球款（itemprice.md 用到的定制球）
    './assets/img/ball-dusk.webp',
    './assets/img/ball-fast.webp',
    './assets/img/ball-heavy.webp',
    './assets/img/ball-quick.webp',
    './assets/img/ball-old.webp',

    // 持有物图标，_dev/fetch_held_items_52poke.py 抓的 52poke SV/ZA 背包图
    './assets/img/item-black-belt.webp',
    './assets/img/item-black-glasses.webp',
    './assets/img/item-charcoal.webp',
    './assets/img/item-dragon-fang.webp',
    './assets/img/item-fairy-feather.webp',
    './assets/img/item-hard-stone.webp',
    './assets/img/item-magnet.webp',
    './assets/img/item-metal-coat.webp',
    './assets/img/item-miracle-seed.webp',
    './assets/img/item-mystic-water.webp',
    './assets/img/item-never-melt-ice.webp',
    './assets/img/item-poison-barb.webp',
    './assets/img/item-sharp-beak.webp',
    './assets/img/item-silk-scarf.webp',
    './assets/img/item-silver-powder.webp',
    './assets/img/item-soft-sand.webp',
    './assets/img/item-spell-tag.webp',
    './assets/img/item-twisted-spoon.webp',
    './assets/img/item-air-balloon.webp',
    './assets/img/item-amulet-coin.webp',
    './assets/img/item-focus-sash.webp',
    './assets/img/item-heavy-duty-boots.webp',
    './assets/img/item-iron-ball.webp',
    './assets/img/item-kings-rock.webp',
    './assets/img/item-leek.webp',
    './assets/img/item-leftovers.webp',
    './assets/img/item-life-orb.webp',
    './assets/img/item-light-ball.webp',
    './assets/img/item-loaded-dice.webp',
    './assets/img/item-lucky-punch.webp',
    './assets/img/item-bright-powder.webp',
    './assets/img/item-choice-band.webp',
    './assets/img/item-choice-scarf.webp',
    './assets/img/item-choice-specs.webp',
    './assets/img/item-clear-amulet.webp',
    './assets/img/item-destiny-knot.webp',
    './assets/img/item-eject-button.webp',
    './assets/img/item-eviolite.webp',
    './assets/img/item-expert-belt.webp',
    './assets/img/item-flame-orb.webp',
    './assets/img/item-safety-goggles.webp',
    './assets/img/item-sticky-barb.webp',
    './assets/img/item-thick-club.webp',
    './assets/img/item-throat-spray.webp',
    './assets/img/item-toxic-orb.webp',
    './assets/img/item-utility-umbrella.webp',
    './assets/img/item-weakness-policy.webp',
    './assets/img/item-white-herb.webp',
    './assets/img/item-wide-lens.webp',
    './assets/img/item-zoom-lens.webp',
    './assets/img/item-metronome.webp',
    './assets/img/item-power-herb.webp',
    './assets/img/item-power-weight.webp',
    './assets/img/item-protective-pads.webp',
    './assets/img/item-quick-claw.webp',
    './assets/img/item-razor-claw.webp',
    './assets/img/item-razor-fang.webp',
    './assets/img/item-red-card.webp',
    './assets/img/item-ring-target.webp',
    './assets/img/item-rocky-helmet.webp',


    // 第二批 DIY 道具图标（_dev/fetch_more_items_52poke.py）
    './assets/img/item-apicot-berry.webp',
    './assets/img/item-assault-vest.webp',
    './assets/img/item-babiri-berry.webp',
    './assets/img/item-big-root.webp',
    './assets/img/item-black-sludge.webp',
    './assets/img/item-charti-berry.webp',
    './assets/img/item-chilan-berry.webp',
    './assets/img/item-chople-berry.webp',
    './assets/img/item-coba-berry.webp',
    './assets/img/item-colbur-berry.webp',
    './assets/img/item-custap-berry.webp',
    './assets/img/item-deep-sea-scale.webp',
    './assets/img/item-deep-sea-tooth.webp',
    './assets/img/item-electric-seed.webp',
    './assets/img/item-ganlon-berry.webp',
    './assets/img/item-grassy-seed.webp',
    './assets/img/item-haban-berry.webp',
    './assets/img/item-kasib-berry.webp',
    './assets/img/item-kebia-berry.webp',
    './assets/img/item-lansat-berry.webp',
    './assets/img/item-liechi-berry.webp',
    './assets/img/item-metal-powder.webp',
    './assets/img/item-micle-berry.webp',
    './assets/img/item-misty-seed.webp',
    './assets/img/item-muscle-band.webp',
    './assets/img/item-occa-berry.webp',
    './assets/img/item-passho-berry.webp',
    './assets/img/item-payapa-berry.webp',
    './assets/img/item-petaya-berry.webp',
    './assets/img/item-psychic-seed.webp',
    './assets/img/item-punching-glove.webp',
    './assets/img/item-quick-powder.webp',
    './assets/img/item-rindo-berry.webp',
    './assets/img/item-roseli-berry.webp',
    './assets/img/item-salac-berry.webp',
    './assets/img/item-scope-lens.webp',
    './assets/img/item-shell-bell.webp',
    './assets/img/item-shuca-berry.webp',
    './assets/img/item-soul-dew.webp',
    './assets/img/item-starf-berry.webp',
    './assets/img/item-tanga-berry.webp',
    './assets/img/item-wacan-berry.webp',
    './assets/img/item-wise-glasses.webp',
    './assets/img/item-yache-berry.webp',


    // 第三批 DIY 树果图标（喂食果 / 降能力果 / 受击果）
    './assets/img/item-grepa-berry.webp',
    './assets/img/item-hondew-berry.webp',
    './assets/img/item-kee-berry.webp',
    './assets/img/item-kelpsy-berry.webp',
    './assets/img/item-maranga-berry.webp',
    './assets/img/item-nanab-berry.webp',
    './assets/img/item-pinap-berry.webp',
    './assets/img/item-pomeg-berry.webp',
    './assets/img/item-qualot-berry.webp',
    './assets/img/item-razz-berry.webp',
    './assets/img/item-tamato-berry.webp',


    // 各地特产图标（状态治愈，_dev/fetch_more_items_52poke.py）
    './assets/img/item-casteliacone.webp',
    './assets/img/item-jubilife-muffin.webp',
    './assets/img/item-lava-cookie.webp',
    './assets/img/item-lumiose-galette.webp',
    './assets/img/item-malasada.webp',
    './assets/img/item-old-gateau.webp',
    './assets/img/item-pewter-crunchies.webp',
    './assets/img/item-rage-candy-bar.webp',
    './assets/img/item-shalour-sable.webp',


    // 战斗道具图标（_dev/fetch_more_items_52poke.py）
    './assets/img/item-blue-flute.webp',
    './assets/img/item-defense-pill.webp',
    './assets/img/item-dire-hit.webp',
    './assets/img/item-double-pickle.webp',
    './assets/img/item-focus-zongzi.webp',
    './assets/img/item-guard-spec.webp',
    './assets/img/item-max-mushroom.webp',
    './assets/img/item-offense-pill.webp',
    './assets/img/item-poke-toy.webp',
    './assets/img/item-red-flute.webp',
    './assets/img/item-timid-ball.webp',
    './assets/img/item-upside-down-yaki.webp',
    './assets/img/item-x-accuracy.webp',
    './assets/img/item-x-all-stats.webp',
    './assets/img/item-x-attack.webp',
    './assets/img/item-x-defense.webp',
    './assets/img/item-x-evasion.webp',
    './assets/img/item-x-sp-atk.webp',
    './assets/img/item-x-sp-def.webp',
    './assets/img/item-x-speed.webp',
    './assets/img/item-yellow-flute.webp',


    // 回复道具补充 + 贵重道具图标（_dev/fetch_more_items_52poke.py）
    './assets/img/item-balm-mushroom.webp',
    './assets/img/item-bamboo-shoot-l.webp',
    './assets/img/item-bamboo-shoot-s.webp',
    './assets/img/item-big-mushroom.webp',
    './assets/img/item-big-nugget.webp',
    './assets/img/item-big-pearl.webp',
    './assets/img/item-canari-bread.webp',
    './assets/img/item-chalk-stone.webp',
    './assets/img/item-comet-shard.webp',
    './assets/img/item-gold-leaf.webp',
    './assets/img/item-good-herbal-medicine.webp',
    './assets/img/item-herbal-medicine.webp',
    './assets/img/item-loose-spring.webp',
    './assets/img/item-marble.webp',
    './assets/img/item-nugget.webp',
    './assets/img/item-odd-keepsake.webp',
    './assets/img/item-pearl.webp',
    './assets/img/item-polished-mud-ball.webp',
    './assets/img/item-pretty-wing.webp',
    './assets/img/item-rare-bone.webp',
    './assets/img/item-relic-band.webp',
    './assets/img/item-relic-copper.webp',
    './assets/img/item-relic-crown.webp',
    './assets/img/item-relic-gold.webp',
    './assets/img/item-relic-silver.webp',
    './assets/img/item-relic-statue.webp',
    './assets/img/item-relic-vase.webp',
    './assets/img/item-sea-glass.webp',
    './assets/img/item-shoal-salt.webp',
    './assets/img/item-shoal-shell.webp',
    './assets/img/item-silver-leaf.webp',
    './assets/img/item-single-earring.webp',
    './assets/img/item-slowpoke-tail.webp',
    './assets/img/item-star-piece.webp',
    './assets/img/item-stardust.webp',
    './assets/img/item-super-herbal-medicine.webp',
    './assets/img/item-sweet-heart.webp',
    './assets/img/item-tiny-mushroom.webp',
    './assets/img/item-tropical-shell.webp',
    './assets/img/item-wooden-doll.webp',

    // 道具图标（itemprice.md 全表，_dev/extract_item_icons.py 生成）
    './assets/img/item-antidote.webp',
    './assets/img/item-aspear-berry.webp',
    './assets/img/item-awakening.webp',
    './assets/img/item-baked-goods.webp',
    './assets/img/item-berry-juice.webp',
    './assets/img/item-big-camping-tent.webp',
    './assets/img/item-burn-heal.webp',
    './assets/img/item-calcium.webp',
    './assets/img/item-camping-stove-cookware.webp',
    './assets/img/item-carbos.webp',
    './assets/img/item-cheri-berry.webp',
    './assets/img/item-chesto-berry.webp',
    './assets/img/item-chocolate.webp',
    './assets/img/item-compass.webp',
    './assets/img/item-dawn-stone.webp',
    './assets/img/item-dry-food.webp',
    './assets/img/item-dusk-stone.webp',
    './assets/img/item-energy-root.webp',
    './assets/img/item-fire-stone.webp',
    './assets/img/item-fishing-rod.webp',
    './assets/img/item-fresh-water.webp',
    './assets/img/item-full-heal.webp',
    './assets/img/item-full-restore.webp',
    './assets/img/item-gourmet-food.webp',
    './assets/img/item-grooming-kit.webp',
    './assets/img/item-hang-glider.webp',
    './assets/img/item-heal-powder.webp',
    './assets/img/item-high-performance-food.webp',
    './assets/img/item-honey.webp',
    './assets/img/item-hp-up.webp',
    './assets/img/item-hyper-potion.webp',
    './assets/img/item-ice-cream.webp',
    './assets/img/item-ice-heal.webp',
    './assets/img/item-ice-stone.webp',
    './assets/img/item-inflatable-boat.webp',
    './assets/img/item-iron.webp',
    './assets/img/item-leaf-stone.webp',
    './assets/img/item-lemonade.webp',
    './assets/img/item-lum-berry.webp',
    './assets/img/item-max-honey.webp',
    './assets/img/item-max-potion.webp',
    './assets/img/item-max-revive.webp',
    './assets/img/item-meal-rations.webp',
    './assets/img/item-moomoo-milk.webp',
    './assets/img/item-moon-stone.webp',
    './assets/img/item-mountain-bike.webp',
    './assets/img/item-oran-berry.webp',
    './assets/img/item-paralyze-heal.webp',
    './assets/img/item-pecha-berry.webp',
    './assets/img/item-pepper-spray-can.webp',
    './assets/img/item-persim-berry.webp',
    './assets/img/item-piece-of-accessory.webp',
    './assets/img/item-pokedex.webp',
    './assets/img/item-pokedex-upgrade.webp',
    './assets/img/item-pokedoll.webp',
    './assets/img/item-pokemon-costume.webp',
    './assets/img/item-pokemon-repel.webp',
    './assets/img/item-potion.webp',
    './assets/img/item-pp-up.webp',
    './assets/img/item-protein.webp',
    './assets/img/item-rare-candy.webp',
    './assets/img/item-rawst-berry.webp',
    './assets/img/item-regional-map.webp',
    './assets/img/item-remedy.webp',
    './assets/img/item-revival-herb.webp',
    './assets/img/item-revive.webp',
    './assets/img/item-saddle.webp',
    './assets/img/item-shiny-stone.webp',
    './assets/img/item-sitrus-berry.webp',
    './assets/img/item-sled.webp',
    './assets/img/item-sleeping-bag.webp',
    './assets/img/item-small-camping-tent.webp',
    './assets/img/item-soda-pop.webp',
    './assets/img/item-sun-stone.webp',
    './assets/img/item-super-potion.webp',
    './assets/img/item-thunder-stone.webp',
    './assets/img/item-tm-basic-move.webp',
    './assets/img/item-tm-high-power.webp',
    './assets/img/item-tm-support.webp',
    './assets/img/item-tr-basic-move.webp',
    './assets/img/item-tr-high-power.webp',
    './assets/img/item-tr-support.webp',
    './assets/img/item-water-stone.webp',
    './assets/img/item-zinc.webp',
    // 第一章的队徽、劲敌头像与世界地图（_dev/extract_world_icons.py 生成）
    './assets/img/team-rocket.webp',
    './assets/img/team-aqua.webp',
    './assets/img/team-magma.webp',
    './assets/img/team-galactic.webp',
    './assets/img/team-plasma.webp',
    './assets/img/team-skull.webp',
    './assets/img/team-flare.webp',
    './assets/img/team-yell.webp',
    './assets/img/team-star.webp',
    './assets/img/rival.webp',
    './assets/img/world-map.webp',
    './assets/img/league-licence.webp',
    // 侧栏章节球（_dev/extract_chapter_icons.py 生成）
    './assets/img/ch-00-intro.webp',
    './assets/img/ch-12-spirit.webp',
    // 招式／战斗图标（_dev/extract_move_icons.py 生成，清单见 _dev/图标调用表.md）
    './assets/img/bf-change-type.webp',
    './assets/img/dur-round.webp',
    './assets/img/dur-scene.webp',
    './assets/img/bf-duration.webp',
    './assets/img/bf-no-evasion-clash.webp',
    './assets/img/bf-no-evasion.webp',
    './assets/img/bf-no-items.webp',
    './assets/img/mv-bite.webp',
    './assets/img/mv-blocking.webp',
    './assets/img/mv-cutter.webp',
    './assets/img/mv-fist.webp',
    './assets/img/mv-late-reaction.webp',
    './assets/img/mv-never-miss.webp',
    './assets/img/mv-ongoing.webp',
    './assets/img/mv-out-of-range.webp',
    './assets/img/mv-powder.webp',
    './assets/img/mv-crit.webp',
    './assets/img/mv-lethal.webp',
    './assets/img/mv-sound.webp',
    './assets/img/mv-shield.webp',
    './assets/img/mv-heal-basic.webp',
    './assets/img/mv-heal-complete.webp',
    './assets/img/mv-heal-minor.webp',
    './assets/img/act-double.webp',
    './assets/img/act-successive.webp',
    './assets/img/act-triple.webp',
    './assets/img/ball-dusk.webp',
    './assets/img/ball-fast.webp',
    './assets/img/ball-heavy.webp',
    './assets/img/ball-old.webp',
    './assets/img/ball-quick.webp',
    './assets/img/cat-physical.webp',
    './assets/img/cat-special.webp',
    './assets/img/cat-support.webp',
    './assets/img/mv-switcher.webp',
    './assets/img/mv-unique.webp',
    './assets/img/mv-vulnerable.webp',
    './assets/img/st-burn1.webp',
    './assets/img/st-confuse.webp',
    './assets/img/st-frozen.webp',
    './assets/img/st-love.webp',
    './assets/img/st-paralysis.webp',
    './assets/img/tgt-ally-all.webp',
    './assets/img/tgt-ally.webp',
    './assets/img/tgt-area.webp',
    './assets/img/tgt-battlefield.webp',
    './assets/img/tgt-field-ally.webp',
    './assets/img/tgt-field-self.webp',
    './assets/img/tgt-foe-all.webp',
    './assets/img/tgt-foe-random.webp',
    './assets/img/tgt-foe.webp',
    './assets/img/tgt-self.webp',
    './assets/img/wx-desolate.webp',
    './assets/img/wx-hail.webp',
    './assets/img/wx-rain.webp',
    './assets/img/wx-sandstorm.webp',
    './assets/img/wx-snow.webp',
    './assets/img/wx-sunny.webp',
    './assets/img/wx-typhoon.webp',
    './assets/img/wx-wind.webp',
    './assets/img/mv-projectile.webp',
    './assets/img/mv-rampage.webp',
    './assets/img/mv-ranged.webp',
    './assets/img/mv-reaction.webp',
    './assets/img/mv-recharge.webp',
    './assets/img/mv-recoil.webp',
    './assets/img/mv-set-damage.webp',
    './assets/img/mv-wind.webp'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            return c.addAll(PRECACHE).catch(function () {
                // 外壳里某个文件临时取不到也不能让整个安装失败
                return Promise.all(PRECACHE.map(function (u) {
                    return c.add(u).catch(function () { return null; });
                }));
            });
        }).then(function () {
            // 正文逐个补，失败不阻塞安装
            return caches.open(CACHE).then(function (c) {
                return Promise.all(PRE_MD.map(function (u) {
                    return c.add(u).catch(function () { return null; });
                }));
            });
        }).then(function () {
            return self.skipWaiting();
        }).catch(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                return k === CACHE ? null : caches.delete(k);
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

// 离线且没缓存过的章节：给一张能看懂的说明，而不是把首页 HTML 当正文渲染
function offlinePage(url) {
    return new Response(
        '# 这一章还没有离线缓存\n\n' +
        '你当前处于**离线状态**，而 `' + url + '` 还没有被下载过。\n\n' +
        '联网后打开一次，之后就能断网阅读了。\n',
        { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } }
    );
}

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;

    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // 外链一律不碰

    var isDoc = req.mode === 'navigate' ||
                /\.md$/i.test(url.pathname) ||
                url.pathname.slice(-1) === '/';

    if (isDoc) {
        // 网络优先：保证内容永远是最新的；断网时回落到缓存
        e.respondWith(
            fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
                }
                return res;
            }).catch(function () {
                return caches.match(req, { ignoreSearch: true }).then(function (hit) {
                    if (hit) return hit;
                    if (req.mode === 'navigate') return caches.match('./index.html');
                    return offlinePage(url.pathname);
                });
            })
        );
        return;
    }

    // 静态资源：先用缓存，同时后台更新
    e.respondWith(
        caches.match(req, { ignoreSearch: true }).then(function (hit) {
            var network = fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
                }
                return res;
            }).catch(function () { return hit; });
            return hit || network;
        })
    );
});
