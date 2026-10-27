/* ============================================================
 * type-data.js — 18 种属性克制关系（第六世代及以后）
 * 单独成文件：内容型数据，与交互逻辑分离，便于校对与复用
 * 字段：zh 中文名 / strong 攻击克制 / weak 被克制 / immunity 免疫
 * ============================================================ */
window.POKE_TYPES = {
    normal:   { zh: '一般',   strong: [],                                weak: ['格斗'],                        immunity: ['幽灵'] },
    fire:     { zh: '火',     strong: ['草', '冰', '虫', '钢'],           weak: ['水', '地面', '岩石'],           immunity: [] },
    water:    { zh: '水',     strong: ['火', '地面', '岩石'],             weak: ['电', '草'],                    immunity: [] },
    electric: { zh: '电',     strong: ['水', '飞行'],                     weak: ['地面'],                        immunity: [] },
    grass:    { zh: '草',     strong: ['水', '地面', '岩石'],             weak: ['火', '冰', '毒', '飞行', '虫'], immunity: [] },
    ice:      { zh: '冰',     strong: ['草', '地面', '飞行', '龙'],       weak: ['火', '格斗', '岩石', '钢'],     immunity: [] },
    fight:    { zh: '格斗',   strong: ['一般', '冰', '岩石', '恶', '钢'], weak: ['飞行', '超能力', '妖精'],       immunity: [] },
    poison:   { zh: '毒',     strong: ['草', '妖精'],                     weak: ['地面', '超能力'],              immunity: [] },
    ground:   { zh: '地面',   strong: ['火', '电', '毒', '岩石', '钢'],   weak: ['水', '草', '冰'],              immunity: ['飞行'] },
    flying:   { zh: '飞行',   strong: ['草', '格斗', '虫'],               weak: ['电', '冰', '岩石'],            immunity: ['地面'] },
    psychic:  { zh: '超能力', strong: ['格斗', '毒'],                     weak: ['虫', '幽灵', '恶'],            immunity: [] },
    bug:      { zh: '虫',     strong: ['草', '超能力', '恶'],             weak: ['火', '飞行', '岩石'],          immunity: [] },
    rock:     { zh: '岩石',   strong: ['火', '冰', '飞行', '虫'],         weak: ['水', '草', '格斗', '地面', '钢'], immunity: [] },
    ghost:    { zh: '幽灵',   strong: ['超能力', '幽灵'],                 weak: ['幽灵', '恶'],                  immunity: ['一般', '格斗'] },
    dragon:   { zh: '龙',     strong: ['龙'],                             weak: ['冰', '龙', '妖精'],            immunity: [] },
    dark:     { zh: '恶',     strong: ['超能力', '幽灵'],                 weak: ['格斗', '虫', '妖精'],          immunity: ['超能力'] },
    steel:    { zh: '钢',     strong: ['冰', '岩石', '妖精'],             weak: ['火', '格斗', '地面'],          immunity: ['毒'] },
    fairy:    { zh: '妖精',   strong: ['格斗', '龙', '恶'],               weak: ['毒', '钢'],                    immunity: ['龙'] }
};
