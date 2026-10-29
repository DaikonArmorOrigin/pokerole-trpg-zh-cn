# 🎯 属性相克表

<div class="type-grid">
    <div class="type-item type-normal"><span class="zh">一般</span><span class="en">Normal</span></div>
    <div class="type-item type-bug"><span class="zh">虫</span><span class="en">Bug</span></div>
    <div class="type-item type-dark"><span class="zh">恶</span><span class="en">Dark</span></div>
    <div class="type-item type-dragon"><span class="zh">龙</span><span class="en">Dragon</span></div>
    <div class="type-item type-electric"><span class="zh">电</span><span class="en">Electric</span></div>
    <div class="type-item type-fairy"><span class="zh">妖精</span><span class="en">Fairy</span></div>
    <div class="type-item type-fight"><span class="zh">格斗</span><span class="en">Fight</span></div>
    <div class="type-item type-fire"><span class="zh">火</span><span class="en">Fire</span></div>
    <div class="type-item type-flying"><span class="zh">飞行</span><span class="en">Flying</span></div>
    <div class="type-item type-ghost"><span class="zh">幽灵</span><span class="en">Ghost</span></div>
    <div class="type-item type-grass"><span class="zh">草</span><span class="en">Grass</span></div>
    <div class="type-item type-ground"><span class="zh">地面</span><span class="en">Ground</span></div>
    <div class="type-item type-ice"><span class="zh">冰</span><span class="en">Ice</span></div>
    <div class="type-item type-poison"><span class="zh">毒</span><span class="en">Poison</span></div>
    <div class="type-item type-psychic"><span class="zh">超能力</span><span class="en">Psychic</span></div>
    <div class="type-item type-rock"><span class="zh">岩石</span><span class="en">Rock</span></div>
    <div class="type-item type-steel"><span class="zh">钢</span><span class="en">Steel</span></div>
    <div class="type-item type-water"><span class="zh">水</span><span class="en">Water</span></div>
</div>

## 属性组合相克

> [!tip] 怎么用
> 点下面任意属性，会依次填进槽位。**只填一个就是单属性**。<br>
> 第三属性平时不开启，毕竟原作只有**森林咒术**或**万圣夜**才会出现三属性的情况。
>
> 下方按 **4× / 2× 弱点**、**1/2× / 1/4× 抗性**、**免疫**分组列出；<br>
> 开了三属性会多出 **8×** 和 **1/8×** 两档。<br>
> 点已填的槽位或再点一次同一个属性可以取消。

<div class="type-dual" id="typeDual">
  <div class="td-slots">
    <button class="td-slot is-active" type="button" data-slot="0" aria-label="第一个属性：未选择">
      <span class="td-slot-hint">属性一</span>
    </button>
    <button class="td-swap" id="tdSwap" type="button" aria-label="交换前两个属性" title="交换前两个属性" disabled>⇄</button>
    <button class="td-slot" type="button" data-slot="1" aria-label="第二个属性：未选择">
      <span class="td-slot-hint">属性二</span>
    </button>
    <button class="td-reset" id="tdReset" type="button" disabled>清空</button>
  </div>

  <div class="td-third">
    <label class="td-switch">
      <input type="checkbox" id="tdThird">
      <span class="td-switch-track" aria-hidden="true"></span>
      <span class="td-switch-label">第三属性</span>
    </label>
    <button class="td-slot td-slot-third" type="button" data-slot="2" aria-label="第三个属性：未开启" disabled>
      <span class="td-slot-hint">属性三</span>
    </button>
    <span class="td-third-hint">森林咒术 / 万圣夜 追加的那一个</span>
  </div>

  <div class="td-picker" id="tdPicker">
    <button class="td-chip type-normal" type="button" data-type="normal" aria-pressed="false">一般</button>
    <button class="td-chip type-bug" type="button" data-type="bug" aria-pressed="false">虫</button>
    <button class="td-chip type-dark" type="button" data-type="dark" aria-pressed="false">恶</button>
    <button class="td-chip type-dragon" type="button" data-type="dragon" aria-pressed="false">龙</button>
    <button class="td-chip type-electric" type="button" data-type="electric" aria-pressed="false">电</button>
    <button class="td-chip type-fairy" type="button" data-type="fairy" aria-pressed="false">妖精</button>
    <button class="td-chip type-fight" type="button" data-type="fight" aria-pressed="false">格斗</button>
    <button class="td-chip type-fire" type="button" data-type="fire" aria-pressed="false">火</button>
    <button class="td-chip type-flying" type="button" data-type="flying" aria-pressed="false">飞行</button>
    <button class="td-chip type-ghost" type="button" data-type="ghost" aria-pressed="false">幽灵</button>
    <button class="td-chip type-grass" type="button" data-type="grass" aria-pressed="false">草</button>
    <button class="td-chip type-ground" type="button" data-type="ground" aria-pressed="false">地面</button>
    <button class="td-chip type-ice" type="button" data-type="ice" aria-pressed="false">冰</button>
    <button class="td-chip type-poison" type="button" data-type="poison" aria-pressed="false">毒</button>
    <button class="td-chip type-psychic" type="button" data-type="psychic" aria-pressed="false">超能力</button>
    <button class="td-chip type-rock" type="button" data-type="rock" aria-pressed="false">岩石</button>
    <button class="td-chip type-steel" type="button" data-type="steel" aria-pressed="false">钢</button>
    <button class="td-chip type-water" type="button" data-type="water" aria-pressed="false">水</button>
  </div>

  <div class="td-result" id="tdResult" role="status" aria-live="polite">
    <p class="td-idle">还没选属性。先点一个（选两个就是双属性）。</p>
  </div>
</div>

## 队伍弱点补盲图

> [!tip] 怎么用
> 最多6只，每只填1～2个属性。下方按18种进攻属性统计。<br>
> 显示的是热力表，**代表队伍抗性缺陷**；浅红为×2，深红为×4。

<div class="team-chart" id="teamChart">
  <div class="tm-list" id="tmList"></div>
  <button class="tm-add" id="tmAdd" type="button">＋ 添加一只</button>
  <div class="tm-result" id="tmResult" role="status" aria-live="polite">
    <p class="td-idle">先给一只宝可梦选属性。</p>
  </div>
</div>
