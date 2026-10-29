# 🎲 快速掷骰

> [!tip] 怎么用
> 填入骰池大小，点「掷骰」。
> **4、5、6 各算一个成功**；1、2、3可以无视，除非启动劲敌能力，否则没有额外惩罚。
>
> 骰池通常等于 **能力值 + 技能**，具体见[掷骰机制](02-system-explained.md#掷骰机制)。

<div class="dice-roller" id="diceRoller">
  <div class="dr-controls">
    <span class="dr-label">骰池</span>
    <button class="dr-step" type="button" data-step="-1" aria-label="减少一颗">−</button>
    <input class="dr-count" id="drCount" type="number" min="1" max="30" value="5"
           inputmode="numeric" aria-label="骰子数量">
    <button class="dr-step" type="button" data-step="1" aria-label="增加一颗">+</button>
    <button class="dr-roll" id="drRoll" type="button">掷骰</button>
  </div>
  <div class="dr-output" id="drOutput" role="status" aria-live="polite">
    <p class="dr-idle">还没掷过。设定好骰池后点「掷骰」。</p>
  </div>
  <section class="dr-log" id="drLog" aria-label="掷骰记录" hidden>
    <div class="dr-log-head">
      <span class="dr-log-title">掷骰记录</span>
      <span class="dr-log-meta" id="drLogMeta"></span>
      <button class="dr-log-clear" id="drLogClear" type="button">清空</button>
    </div>
    <ol class="dr-log-list" id="drLogList"></ol>
  </section>
</div>

---

## 结果怎么看

- 每一格是一颗六面骰的点数，**红底那颗**就是成功骰。
- 下方「成功 N ／ 共 M 颗」是本轮的合计。
- 掷过的结果会自动记在下面的「掷骰记录」里，带时间、每颗点数和成功数，**只存在这台设备的浏览器里**（而且清缓存就没了）。

## 常见判定

|行动所需成功数|难度等级|说明|
|:---:|:---:|----------|
| 1 | 棘手 | 该行动几乎不构成阻碍。 |
| 2 | 挑战 | 该行动需要付出相当努力。 |
| 3 | 困难 | 完成该行动会让人精疲力尽。 |
| 4 | 极难 | 该行动会让你付出代价或置身险境。 |
| 5+ | 近乎不可能 | 所有迹象表明普通人无法完成该行动。 |

|多重行动|所需成功数|难度等级|
|:---:|:---:|:---:|
| 行动1 | 1 | 棘手 |
| 行动2 | 2 | 挑战 |
| 行动3 | 3 | 困难 |
| 行动4 | 4 | 极难 |
| 行动5 | 5 | 近乎不可能 |
