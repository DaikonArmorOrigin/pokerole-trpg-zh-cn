# 🎲 快速掷骰

> [!tip] 怎么用
> 填入骰池大小，点「掷骰」。
> **4、5、6 各算一个成功**；1、2、3 只是没成功，没有额外惩罚。
>
> 骰池通常等于 **能力值 + 技能**，具体见[系统详解](02-system-explained.md)里的掷骰机制。

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
</div>

---

## 结果怎么看

- 每一格是一个六面骰的点数，**红色格子**就是成功骰。
- 下方「成功 N ／ 共 M 颗」是本轮的合计。

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
| 行动 1 | 1 | 棘手 |
| 行动 2 | 2 | 挑战 |
| 行动 3 | 3 | 困难 |
| 行动 4 | 4 | 极难 |
| 行动 5 | 5 | 近乎不可能 |
