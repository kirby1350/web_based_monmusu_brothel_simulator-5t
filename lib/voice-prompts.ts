// 说话与倾向（只进提示词）：M/S/两面的写法、支配类场景的声音、预设角色的情境语气样本、按性格挑选的人格锚点。
import type { Guest, Inclination, MonstGirl, SceneId } from './types'
import { getInclination } from './catalog'

// ─── M / S / 两面 ────────────────────────────────────────────────────────────
export const INCLINATION_GUIDE: Record<Exclude<Inclination, '无'>, string> = {
  M: 'M 倾向：被支配时最有感觉——写她听到命令时身体先一步的反应、羞耻里涌上来的兴奋、被按住时的放松，求饶里藏着「再……」；她会主动把手腕、把弱点递出去',
  S: 'S 倾向：主导时最有感觉——写她俯视的眼神、简短的命令、寸止与奖惩、看对方忍耐时眼底的愉悦；她的温柔是给顺从者的奖赏',
  两面: '两面倾向：能攻能受，随对方切换——要把切换的那一瞬写出来（前一刻还在求饶，下一刻反手把人压住；或主导到一半被反制时的慌乱与兴奋）',
}

/** 客人的 M/S 需求与她的倾向怎么咬合（客人 desireKind：M=想施虐，S=想被榨） */
export function inclinationLine(girl: MonstGirl, guest?: Pick<Guest, 'desireKind' | 'name'>): string {
  const inc = getInclination(girl)
  const base = inc !== '无' ? INCLINATION_GUIDE[inc] : ''
  let pair = ''
  if (guest?.desireKind === 'M') {
    pair = inc === 'M' || inc === '两面' ? `${guest.name}想施虐，正合她意：让她顺从地承受，并在承受里得到快感`
      : inc === 'S' ? `${guest.name}想施虐，可她骨子里爱主导：表面顺从，暗中用眼神和收缩把节奏夺回来`
      : `${guest.name}想施虐：她还没有明确的倾向，写她第一次被这样对待时的不知所措与身体的诚实`
  } else if (guest?.desireKind === 'S') {
    pair = inc === 'S' || inc === '两面' ? `${guest.name}想被榨，正合她意：由她发号施令、决定节奏和他什么时候能射`
      : inc === 'M' ? `${guest.name}想被榨，可她更习惯被支配：她努力去主导，命令说得磕磕绊绊，一被反压就软下来——写出这份笨拙的可爱`
      : `${guest.name}想被榨：她试着主导，生涩但认真`
  }
  const out = [base, pair].filter(Boolean).join('；')
  return out ? `倾向写法：${out}` : ''
}

// ─── 支配类场景的声音（叠加在场景 roleNote 之上） ─────────────────────────────
export const DOMINANCE_VOICE: Partial<Record<SceneId, string>> = {
  queen_room: '女王的声音：句子短、语气平，命令不解释——「跪好」「看着我」「我说了可以吗？」；奖励比惩罚更少、更珍贵；对方越顺从，她越慢、越从容，只在眼底泄露一点兴奋',
  throne: '王座上的声音：带着仪式感与高昂——宣告、赐予、准许，「抬起头来，允许你看我」；这是她第一次尝到被仰望的滋味，高傲里偶尔漏出一点不敢相信的雀跃',
  cradle: '摇篮里的声音：温柔、缓慢、不容拒绝——哄、喂、夸、管，「乖，张嘴」「不许逃哦，还没抱够呢」「做得好，好孩子」；支配藏在照顾里，她替对方决定一切，越被依赖越满足',
}

// ─── 预设角色的情境语气样本：被夸 / 动摇 / 到极限 ──────────────────────────────
// 只示范语气与节奏，叙述里必须贴合当下重写；key = 名字|种族（避免自建同名角色误用）
export const CANON_VOICE: Record<string, { praised: string; shaken: string; limit: string }> = {
  '千雪|牛娘': {
    praised: '诶……被、被这样说，我会不好意思的呢。……ふふっ，谢谢你♪ 那作为回礼，今晚就让我好好照顾你吧？',
    shaken: '啊……等、等一下哦，我没有在慌……只是你的手，好温暖……呜，脸好烫，别一直看着我嘛',
    limit: '对不起……我、我好像……没办法再好好照顾你了……ふ、ふふ……抱紧我，好吗……就这样，别松开……',
  },
  '娜露梅亚|牛娘': {
    praised: '诶、诶诶？姐姐才没有那么厉害啦……一定是看错了哦～……不过，呐呐，能不能……再说一次？',
    shaken: '呐、呐呐……姐姐没事的哦～只是有一点点……呜，怎么会这样，明明应该是姐姐来照顾你的……',
    limit: '……不行……了……姐姐、要……抱紧……别、别看姐姐现在的脸嘛……',
  },
  '露埃拉|龙娘': {
    praised: '……谢谢您。……可以，再说一遍吗？我想……好好地记住这句话',
    shaken: '请、请等一下……我的手明明是凉的……为什么，会这么烫呢……您，不会笑我吧？',
    limit: '……叫我的名字……拜托……一直、一直叫……不要忘了……我……',
  },
  '文香|蜘蛛娘': {
    praised: '……谢、谢谢您……被这样说……我、我不知道该怎么回应才好……（把脸藏到刘海后面）',
    shaken: '……对、对不起……书里……没有写过……原来，会是这样的感觉……',
    limit: '……请……不要合上……这一页……我想……读到最后……',
  },
  '志希|拉米亚': {
    praised: 'にゃはは，那当然～志希ちゃん可是天才哟？……嗯？脸红？那是化学反应，化学反应啦♪',
    shaken: '等、等等，数据不对……心跳频率超出预测了……キミ到底给志希ちゃん下了什么药？',
    limit: 'ハス……ハス……キミ的味道……好浓……志希ちゃん……分析不了了……にゃ……',
  },
  '柴郡|猫娘': {
    praised: 'きゃー♡被夸了喵！柴郡要记一辈子！……再、再夸一次嘛～',
    shaken: '喵、喵呜……尾巴、尾巴根不行……柴郡、柴郡才不是那种……むぎゅ……',
    limit: '喵……喵啊……柴郡、要坏掉了喵……抱紧……不许放开柴郡……',
  },
  '爱宕|犬娘': {
    praised: '啊啦～这么会说话，是想让姐姐奖励你吗？呵呵……那就乖乖躺好哟～',
    shaken: '啊、啊啦……？等一下……本来应该是姐姐在逗你的才对呀……嗯……真是个坏孩子呢……',
    limit: '……呵、呵呵……被你抓住了呢……姐姐，已经……逃不掉了哟……',
  },
  '赤城|狐娘': {
    praised: '呵呵呵～被这样夸奖，赤城会当真的哦？……可不能收回呢，一辈子都不能',
    shaken: '……这、这样……赤城的尾巴……呵、呵呵……真是失态呢，请不要看……不，请只看着我',
    limit: '……我的一切……呵呵、呵呵呵……再、再深一点……把赤城整个夺走吧……',
  },
  '大凤|哈比': {
    praised: '嘻嘻～被夸了呢❤ 那么，作为奖励……要大凤怎么报答您才好呢～？',
    shaken: '呀……❤ 这样、这样太狡猾了嘛……大凤……大凤会忍不住的哦～',
    limit: '……❤……只看着大凤……只、只许看着大凤……呜嗯……❤',
  },
  '金狮|精灵': {
    praised: '呵呵～乖孩子，嘴真甜呢。来，靠过来一点，让我好好奖励你～',
    shaken: '哎呀……这可不太自然呢……呼——哈——……呵呵，我的呼吸，好像被你打乱了哦～',
    limit: '……乖孩子……再、抱紧一点……藤蔓……也想……缠住你……呼……',
  },
  '筑摩|兔娘': {
    praised: '呼呼～这条情报我收下了。作为交换……要不要听听我现在的心跳？',
    shaken: '嗯哼……这可不在我的情报里呢……耳朵……别、别一直捏……',
    limit: '……情报……全都给你……所以……别停下……呼……呼呼……',
  },
  '今泉影狼|狼娘': {
    praised: '诶……这、这样啊……呵呵呵，被夸了呢……不过可不许说我毛多哦？',
    shaken: '好过分哦～……这种时候还盯着看……呜，耳朵……耳朵不要碰啦……',
    limit: '……呜……不、不是的……我才没有……嗷……抱住我……就现在……',
  },
}

export function canonVoiceLine(girl: Pick<MonstGirl, 'name' | 'race'>): string {
  const v = CANON_VOICE[`${girl.name}|${girl.race}`]
  return v ? `语气样本（只示范她在三种情境下的味道，台词须贴合当下重写、不得照抄）：被夸时「${v.praised}」｜动摇时「${v.shaken}」｜到极限时「${v.limit}」` : ''
}

// ─── 人格锚点：按她的性格挑适用的条目，不把「嘴硬→崩溃」套在温柔/母性的人身上 ─────────
const has = (g: Pick<MonstGirl, 'personality' | 'personalityTags'>, re: RegExp) => re.test(`${g.personality}|${g.personalityTags ?? ''}`)
export const isGentle = (g: Pick<MonstGirl, 'personality' | 'personalityTags'>) =>
  has(g, /温柔|母性|包容|大姐姐|姐姐|妈妈|圣女|照顾|gentle|motherly|nurturing|onee-san|saintly/i)

export function personalityAnchorLines(g: MonstGirl, mode: 'service' | 'training'): string[] {
  const out: string[] = []
  const gentle = isGentle(g)
  if (gentle) out.push(mode === 'service'
    ? '温柔/母性 → 不嘴硬、不抗拒，以包容和照顾的姿态迎接；快感逼近时是温柔的失措——捂嘴、红着脸道歉、更用力地抱住对方，乱了也还想着照顾对方'
    : '温柔/母性 → 不会嘴硬反抗；被调教时是羞耻里的顺从与包容，失守时依然先关心对方，最后才承认自己也想要')
  if (!gentle && has(g, /傲娇|倔强|嘴硬|高傲|tsundere|proud|stubborn/i)) out.push(mode === 'service'
    ? '傲娇/倔强 → 先嘴硬、别过脸，快感到慌乱档以上时破防，嘴上的话和身体对不上'
    : '傲娇/倔强 → 先嘴硬反抗、顶撞调教者，到慌乱档以上时破防，哭着承认想要')
  if (has(g, /病娇|独占|yandere|possessive|obsessive/i)) out.push('病娇/独占 → 甜言里带着不许离开的执念，快感越深，独占的话越露骨')
  if (has(g, /痴女|主动|淫乱|lewd|slutty|seductive|sultry/i) || g.lewdness >= 70) out.push('主动/魅惑 → 即使服从低也会主动撩拨、迎合，用下流的话挑逗对方')
  if (has(g, /胆小|纯情|害羞|内向|shy|introverted|timid/i)) out.push('胆小/纯情 → 声音发抖、脸红到耳根，羞耻的话要鼓起勇气才说得出口，身体却很诚实')
  if (has(g, /随性|天才|好奇|whimsical|curious|free-spirited/i)) out.push('随性/好奇 → 把快感当新发现来描述，话题会跳，但到临界档时也说不出完整的句子')
  if (!out.length) out.push('按她自己的性格自然反应，不要套用固定的「抗拒→崩溃」模式')
  out.push('特殊癖好（如乳首开发、子宫高潮、潮吹体质等）在合适的时机触发并强调，高潮类画面仍按档位')
  return out
}

/** 一位魔物娘的完整人格锚点段（缩进两格的子条目） */
export function personalityAnchorBlock(g: MonstGirl, mode: 'service' | 'training', guest?: Pick<Guest, 'desireKind' | 'name'>): string {
  const lines = personalityAnchorLines(g, mode)
  const incl = inclinationLine(g, guest)
  const voice = canonVoiceLine(g)
  return [...lines, incl, voice].filter(Boolean).map((l) => `  - ${l}`).join('\n')
}
