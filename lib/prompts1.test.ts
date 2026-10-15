import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLAYS, RACE_PLAYS, ALL_PLAYS } from './catalog'
import { PRESET_FLOWS } from './service-flows'
import { PLAY_CRAFT, SKILL_CRAFT, STEP_HOW, RACE_FLOW_DETAIL, buildCraftBlock, playTier, presetFlowRace, playStepOf } from './play-prompts'
import { fxGirl as makeGirl } from './prompt-fixtures'

test('1. 每个 play（7 通用 + 23 种族）和 7 项技能都有要点/感官/三档', () => {
  assert.equal(PLAYS.length, 7)
  assert.equal(Object.values(RACE_PLAYS).flat().length, 23)
  for (const p of ALL_PLAYS) {
    const e = PLAY_CRAFT[p.id]
    assert.ok(e, p.id)
    assert.ok(e.essence.length > 20 && e.sense.length > 15, p.id)
    for (const t of ['初学', '熟练', '精通'] as const) assert.ok(e.tiers[t].length > 6, `${p.id} ${t}`)
  }
  for (const k of ['待客', '手技', '口侍', '胸侍', '身侍', 'M性', 'S性'] as const) assert.ok(SKILL_CRAFT[k].tiers['精通'])
  assert.equal(STEP_HOW.length, 5)
  for (const f of PRESET_FLOWS) assert.equal(RACE_FLOW_DETAIL[f.race]?.length, 5, f.race)
})

test('1. 写作素材只注入当前步骤与挂在这一步的 play，档位随熟练度', () => {
  const g = makeGirl({ race: '牛娘', proficiency: { 待客: 0, 手技: 0, 口侍: 0, 胸侍: 80, 身侍: 0, M性: 0, S性: 0 } })
  const b3 = buildCraftBlock({ stepIndex: 3, girl: g, mainSkill: '胸侍', playIds: ['race_cow_milk'], flowRace: '牛娘' })
  assert.match(b3, /乳汁侍奉/)
  assert.match(b3, /胸侍（/)
  assert.match(b3, /奶香越来越浓/)
  assert.doesNotMatch(b3, /深喉/)
  const b0 = buildCraftBlock({ stepIndex: 0, girl: g, mainSkill: '胸侍', playIds: [], flowRace: '牛娘' })
  assert.match(b0, /迎客：/)
  assert.match(b0, /待客（.*未学/)
  assert.doesNotMatch(b0, /乳汁侍奉/)
  assert.ok(b3.length < 900, `size ${b3.length}`)
  assert.equal(playTier(g, 'paizuri'), playTier(g, 'race_cow_milk'))
})

test('1. 内置流程细节只在这一步没改过时给；play 的步骤归属', () => {
  const pf = PRESET_FLOWS.find((f) => f.race === '牛娘')!
  assert.equal(presetFlowRace({ choice: pf.id, actions: pf.actions }, 2), '牛娘')
  const edited = pf.actions.map((a, i) => (i === 2 ? '改过的' : a))
  assert.equal(presetFlowRace({ choice: pf.id, actions: edited }, 2), undefined)
  assert.equal(presetFlowRace({ choice: 'std', actions: pf.actions }, 2), undefined)
  assert.equal(playStepOf('x', { x: 1 }, { x: 2 }), 1)
  assert.equal(playStepOf('x', undefined, { x: 2 }), 2)
  assert.equal(playStepOf('x', undefined, undefined), 3)
})

import { buildServiceSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { fxPlayer, fxGuest } from './prompt-fixtures'
import { buildStepContext, STEP_INTENSITY } from './live-steps'
import { heatPromptBlock, climaxGateLine, initHeat } from './arousal'
import { climaxSlipNote } from './prompt-context'

const svc = (o: Parameters<typeof buildServiceSystemPrompt>[4] = {}, girls = [makeGirl()], guest = fxGuest()) =>
  buildServiceSystemPrompt(fxPlayer, createServiceSession('service', girls, { guest }), 'standard', undefined, o)

test('2. 反应锚点与客人规则不再用快感数字触发高潮；写作规则 2 不再每回合要求喷射/灌满', () => {
  const p = svc({ heatLocal: true })
  assert.doesNotMatch(p, /快感≥\d+|快感\d+\+|快感<\d+|80\+ ?→|肉棒快感80/)
  assert.match(p, /只属于「高潮」档/)
  assert.match(p, /客人到临界档/)
  assert.doesNotMatch(p, /精液灌满视觉冲击|淫液四溅喷射/)
  assert.match(p, /强度上限/)
})

test('2. 高潮闸门：只有被标为高潮的人能写高潮，其余最多濒临', () => {
  const g = makeGirl()
  const h0 = initHeat(fxGuest(), [g])
  assert.match(climaxGateLine(h0, '王老板', [g]), /没有人到达高潮/)
  const h1 = { ...h0, justClimaxed: ['guest'] }
  assert.match(climaxGateLine(h1, '王老板', [g]), /只有王老板可以写高潮（客人射精）/)
  assert.match(heatPromptBlock(h1, '王老板', [g]), /高潮闸门：本回合只有王老板/)
})

test('2. 每一步的强度上限进提示词：迎客/挑逗/前戏不插入，清洗不再开激烈玩法', () => {
  assert.equal(STEP_INTENSITY.length, 5)
  const c0 = buildStepContext({ stepLabel: '迎客', standardAction: 'x', outfitName: '常服', plays: [], stepIndex: 0 })
  assert.match(c0, /强度上限.*不插入/)
  const c2 = buildStepContext({ stepLabel: '前戏', standardAction: 'x', outfitName: '常服', plays: [], stepIndex: 2 })
  assert.match(c2, /不插入小穴或后庭/)
  assert.match(buildStepContext({ stepLabel: '清洗', standardAction: 'x', outfitName: '常服', plays: [], stepIndex: 4 }), /不再开新的激烈玩法/)
  assert.doesNotMatch(buildStepContext({ stepLabel: '迎客', standardAction: 'x', outfitName: '常服', plays: [] }), /强度上限/)
})

test('2. 本地回看：未到高潮档却写了射精/潮吹 → 下一回合校正；到档或只是濒临不校正', () => {
  assert.match(climaxSlipNote('他低吼一声，滚烫地射进她的深处。', []), /校正.*射精/)
  assert.match(climaxSlipNote('她浑身痉挛，潮吹了一地。', ['guest']), /她的高潮/)
  assert.equal(climaxSlipNote('他低吼一声，射进她的深处。', ['guest']), '')
  assert.equal(climaxSlipNote('「要去了……还不行……」她咬着唇忍住，他也在射精的边缘死死忍着。', []), '')
  assert.equal(climaxSlipNote('正文<!--STATS:{"内射":1}-->', []), '')
})

import { outfitDescLine, outfitCommentLine } from './prompt-context'
import { buildOpeningDialoguePrompt } from './prompt-builder'

test('3. 换了服装：提示词用目录描写取代常服；没换时仍是常服；协同保持自己的衣服', () => {
  const p = svc({ outfit: 'qipao', stockings: 'black', heatLocal: true })
  assert.match(p, /服装：今晚换上的「高开衩旗袍」——绛红缎面/)
  assert.match(p, /黑色薄丝裤袜——薄得透出肤色/)
  assert.doesNotMatch(p, /服装：白色巫女服\n/)
  assert.match(svc({ outfit: 'regular' }), /服装：白色巫女服\n/)
  const two = svc({ outfit: 'maid' }, [makeGirl(), makeGirl({ id: 'b', name: '小二', outfit: '红色斗篷' })])
  assert.match(two, /服装：红色斗篷\n/)
  assert.equal(outfitDescLine(makeGirl(), 'regular', 'none'), '白色巫女服')
})

test('3. 客人服装喜好命中 → 点名评论这身；没命中 → 一句遗憾；无喜好 → 不写', () => {
  assert.match(outfitCommentLine(fxGuest({ prefOutfit: '黑丝' }), 'regular', 'black'), /正穿着「黑色薄丝裤袜」.*具体地评论/)
  assert.match(outfitCommentLine(fxGuest({ prefOutfit: '和服' }), 'maid', 'none'), /没穿/)
  assert.equal(outfitCommentLine(fxGuest({ prefOutfit: null }), 'maid', 'none'), '')
  assert.match(svc({ outfit: 'regular', stockings: 'black' }), /【服装反应】王老板偏爱「黑丝」/)
  const op = buildOpeningDialoguePrompt('service', fxPlayer, [makeGirl()], { guest: fxGuest(), outfit: 'kimono', stockings: 'none' })
  assert.match(op, /今晚的服装】今晚换上的「松襟振袖」/)
})

import { GIRL_TEMPLATES } from './game-data'
import { CANON_VOICE, canonVoiceLine, inclinationLine, isGentle, personalityAnchorLines } from './voice-prompts'
import { sceneContext } from './prompt-context'

const canon = (name: string) => makeGirl({ ...GIRL_TEMPLATES.find((t) => t.name === name)!, id: name })

test('4. 每位预设角色都有被夸/动摇/极限三条语气样本，并进服务提示词；自建同名不同族不误用', () => {
  for (const t of GIRL_TEMPLATES) {
    const v = CANON_VOICE[`${t.name}|${t.race}`]
    assert.ok(v, t.name)
    assert.ok(v.praised && v.shaken && v.limit, t.name)
  }
  const p = buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [canon('千雪')], { guest: fxGuest() }), 'standard', undefined, { heatLocal: true })
  assert.match(p, /语气样本.*被夸时「诶……被、被这样说/)
  assert.equal(canonVoiceLine(makeGirl({ name: '千雪', race: '狐娘' })), '')
})

test('4. 温柔/母性（千雪、娜露梅亚、爱宕）不被套上「嘴硬→崩溃」；傲娇仍有', () => {
  for (const n of ['千雪', '娜露梅亚', '露埃拉', '爱宕', '金狮']) {
    const g = canon(n)
    assert.ok(isGentle(g), n)
    const lines = personalityAnchorLines(g, 'service').join('\n')
    assert.doesNotMatch(lines, /先嘴硬/, n)
    assert.match(lines, /温柔\/母性/, n)
  }
  const p = buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [canon('千雪')], { guest: fxGuest() }), 'standard', undefined, { heatLocal: true })
  assert.doesNotMatch(p, /先嘴硬羞辱\/抗拒/)
  assert.match(personalityAnchorLines(makeGirl(), 'service').join(''), /傲娇\/倔强 → 先嘴硬/)
  assert.match(personalityAnchorLines(makeGirl(), 'training').join(''), /顶撞调教者/)
})

test('4. M/S/两面写法随倾向，与客人的施虐/被榨需求咬合', () => {
  const m = makeGirl({ proficiency: { 待客: 0, 手技: 0, 口侍: 0, 胸侍: 0, 身侍: 0, M性: 60, S性: 0 } })
  const s = makeGirl({ proficiency: { 待客: 0, 手技: 0, 口侍: 0, 胸侍: 0, 身侍: 0, M性: 0, S性: 60 } })
  assert.match(inclinationLine(m, { desireKind: 'M', name: '甲' }), /M 倾向.*正合她意/)
  assert.match(inclinationLine(m, { desireKind: 'S', name: '甲' }), /磕磕绊绊/)
  assert.match(inclinationLine(s, { desireKind: 'S', name: '甲' }), /S 倾向.*由她发号施令/)
  assert.match(inclinationLine(s, { desireKind: 'M', name: '甲' }), /暗中/)
})

test('4. 女王调教室/王座间/摇篮寝殿带支配的声音', () => {
  assert.match(sceneContext({ girl: canon('千雪'), scene: 'cradle' }), /摇篮里的声音.*乖，张嘴/)
  assert.match(sceneContext({ girl: makeGirl(), scene: 'queen_room' }), /女王的声音/)
  assert.match(sceneContext({ girl: makeGirl(), scene: 'throne' }), /王座上的声音/)
})

import { divisionBlock, partnerRole, synergyInteractions } from './multi-prompts'

test('5. 多人分工：主位做主类型，协同按最拿手的技能分工（避开主类型），默契来源写成互动', () => {
  const lead = makeGirl({ id: 'a', name: '甲', race: '牛娘', affection: 70 })
  const oral = makeGirl({ id: 'b', name: '乙', race: '牛娘', affection: 70, proficiency: { 待客: 10, 手技: 0, 口侍: 80, 胸侍: 50, 身侍: 0, M性: 0, S性: 0 } })
  const none = makeGirl({ id: 'c', name: '丙', race: '猫娘', proficiency: { 待客: 0, 手技: 0, 口侍: 0, 胸侍: 0, 身侍: 0, M性: 0, S性: 0 } })
  const guest = fxGuest({ desires: '想要乳交', desireService: '胸侍', prefRace: '牛娘' })
  assert.equal(partnerRole(oral, '胸侍'), '口侍')
  assert.equal(partnerRole(oral, '口侍'), '胸侍')
  assert.equal(partnerRole(none, '胸侍'), '无')
  const it = synergyInteractions(lead, oral, guest).join('\n')
  assert.match(it, /同族的姐妹配合/)
  assert.match(it, /默契十足/)
  assert.match(it, /正合王老板的偏好/)
  const b = divisionBlock(lead, [oral, none], guest, 3)
  assert.match(b, /甲（主位）：负责主类型/)
  assert.match(b, /乙（协同·口侍）/)
  assert.match(b, /丙（协同·还没有拿手的技能）/)
  assert.match(divisionBlock(lead, [oral], guest, 2), /仍不插入/)
  assert.equal(divisionBlock(lead, [], guest, 3), '')
})
