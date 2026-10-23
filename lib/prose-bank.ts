// 重油文风的词库（只进提示词）：拟声 / 体液 / 触感 / 温度 / 气味 / 部位别称 / 淫语 / 动作 / 修饰前缀。
// 每回合按当前步骤筛（前面的步骤不给性器与体液，高潮类只在高潮档给），再抽一部分，避开最近用过的，让措辞每回合都换。

/** step：这一步起才可用（0 迎客 … 3 正戏）；climax：只在有人到「高潮」档时给 */
export interface BankWord { w: string; step?: number; climax?: boolean }
const W = (list: string, step = 0, climax = false): BankWord[] => list.split(/\s+/).filter(Boolean).map((w) => ({ w, step, climax }))

export const PROSE_BANK: Record<string, { label: string; pick: number; words: BankWord[] }> = {
  sound: { label: '拟声', pick: 5, words: [
    ...W('啾 啵 咕嘟 嘶哈 哈啊 呼哧 嘤咛 窸窣 沙沙 叮铃 吱呀 咂 吧唧 咕噜 唔嗯'),
    ...W('咕啾 噗滋 滋溜 咕叽 啾噜 黏答答 嗞啾', 2),
    ...W('啪啪 啪嗒 噗啾 咕唧咕唧 噗嗤', 3),
  ] },
  fluid: { label: '体液与湿度', pick: 4, words: [
    ...W('香汗 涎丝 银丝 汗珠 湿痕 水光 黏丝'),
    ...W('蜜液 爱液 淫水 前液 湿漉漉的腿根 拉丝的蜜', 2),
    ...W('白浊 精浆 潮水 浓稠的精 溢出的白', 3, true),
  ] },
  touch: { label: '触感', pick: 6, words: W('软糯 绵密 弹嫩 滑腻 黏稠 湿濡 紧致 肥厚 丰腴 酥软 细腻 温润 厚实 鼓胀 紧绷 颤巍巍 沉甸甸 肉乎乎 油亮 雪腻 脂滑 绵软 肥嫩 Q弹') },
  temp: { label: '温度', pick: 3, words: W('滚烫 灼热 温热 热乎乎 烫人 暖融融 蒸腾 凉滑 冰凉 微烫 热辣') },
  smell: { label: '气味', pick: 3, words: [
    ...W('奶香 甜腻体香 汗香 脂粉香 熟果般的甜香 皂角香 发丝的香 酒气'),
    ...W('雌香 发情的腥甜 麝香 荷尔蒙气息 潮湿的雌味 腥膻', 2),
  ] },
  part: { label: '部位别称', pick: 7, words: [
    ...W('雪腻乳肉 肥软奶球 乳峰 乳沟 蜜桃臀 肥臀 臀肉 丝腿 大腿根 腿弯 足弓 玉足 柳腰 腰窝 樱唇 软舌 香舌 檀口 锁骨窝 耳垂 后颈'),
    ...W('奶尖 乳晕 臀缝 花唇 花核 穴口 肉缝 肉棒 龟头 柱身 马眼 囊袋 青筋', 2),
    ...W('蜜穴 蜜壶 宫口 内壁 褶皱 最深处', 3),
  ] },
  verb: { label: '动作', pick: 5, words: [
    ...W('揉 捏 搓 蹭 贴 裹 舔 吮 嘬 咂 含 抚 摩挲'),
    ...W('挤 夹 磨 撸 套弄 吸吮', 2),
    ...W('顶 碾 绞 吞 夯 撞 研磨 抽送', 3),
  ] },
  voice: { label: '淫语', pick: 3, words: [
    ...W('「再靠近一点嘛」 「都被你看光了……」 「好热……」 「别、别盯着看呀」 「心跳好快……」'),
    ...W('「那里……不可以……」 「手指好烫……」 「湿、湿掉了……」 「再、再用力一点」', 2),
    ...W('「里面……全是你的形状」 「要被顶坏了」 「不要停……」 「好深……」 「要、要去了——」', 3),
  ] },
  mod: { label: '修饰前缀（叠在部位前）', pick: 6, words: W('肥 厚 脂 油 腻 糯 雪 嫩 软 熟 湿 烫 沉 鼓 颤 香 粉 红') },
}

/** 简单可复现的随机（同一回合同一组） */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}

export interface BankOpts { stepIndex: number; climaxAllowed: boolean; seed: number; avoid?: string[] }

/** 这一回合可用的词：按步骤与高潮档筛 */
export function availableWords(cat: string, o: Pick<BankOpts, 'stepIndex' | 'climaxAllowed'>): string[] {
  return PROSE_BANK[cat].words.filter((x) => (x.step ?? 0) <= o.stepIndex && (!x.climax || o.climaxAllowed)).map((x) => x.w)
}

/** 每类抽 pick 个，先避开最近用过的；不够再补 */
export function sampleBank(o: BankOpts): Record<string, string[]> {
  const r = rng(o.seed + o.stepIndex * 101)
  const avoid = new Set(o.avoid ?? [])
  const out: Record<string, string[]> = {}
  for (const [cat, def] of Object.entries(PROSE_BANK)) {
    const pool = availableWords(cat, o)
    const fresh = pool.filter((w) => !avoid.has(w)), used = pool.filter((w) => avoid.has(w))
    const shuffle = (a: string[]) => a.map((w) => [r(), w] as const).sort((x, y) => x[0] - y[0]).map(([, w]) => w)
    out[cat] = [...shuffle(fresh), ...shuffle(used)].slice(0, def.pick)
  }
  return out
}

/** 从一段回复里找出用到的词库词（去掉数据块；单字的修饰前缀与动作不计） */
export function bankWordsUsed(text: string): string[] {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '')
  const all = new Set<string>()
  for (const [cat, def] of Object.entries(PROSE_BANK)) {
    if (cat === 'mod') continue
    for (const { w } of def.words) {
      const core = w.replace(/[「」]/g, '').replace(/……|——/g, '')
      if (core.length >= 2 && clean.includes(core)) all.add(w)
    }
  }
  return [...all]
}

export const DENSE_MIN_WORDS = 12
export const DENSE_LENGTH = { min: 800, max: 1200 }
/** 聊天流式回复的前端超时：要容得下重油长回复（实测 ~25 字/秒，2700+ 字约 110 秒）+ STATS 块 */
export const STREAM_TIMEOUT_MS = 180_000

/** 【★重油文风★】段：放在系统提示词最末尾，作为最后、最高优先级的文风指令 */
/** 提示里写的字数。模型实际会多写两三成，写这个数时实际落在 DENSE_LENGTH 附近。 */
export const DENSE_PROMPT_LENGTH = { min: 450, max: 650 }

/** 原创结构示例，每回合轮换一段，只示范「动作 → 台词 → 反应」的节拍。 */
export const DENSE_EXEMPLARS: string[] = [
  `她把客人的手按在自己胸口，让掌心陷进去。「……这样，摸得到心跳吗？」话没说完，耳根先红了，手却没松开。`,
  `她跪在榻前，替他解开衣带，指尖蹭过小腹时故意停了一下。「客人这里，已经等不及了呢～」她抬眼一笑，呼吸也乱了。`,
  `他捏住她的下巴吻下去，咂的一声才放开。「唔嗯……喘不过气了……」她攥着他衣襟的手松开，嘴唇又自己凑了回去。`,
  `他的手指隔着薄纱按住那一点，慢慢打转。「那、那里不行……嗯啊……」她一边推他的手腕，一边把腰往他手上送。`,
]

function densParas(max: number): string {
  return max <= 500 ? '3 到 5' : '8 到 12'
}

export function denseStyleBlock(o: BankOpts): string {
  const sampled = sampleBank(o)
  const rows = Object.entries(sampled).map(([cat, words]) => `- ${PROSE_BANK[cat].label}：${words.join('、')}`)
  const recent = (o.avoid ?? []).slice(-10)
  if (recent.length) rows.push(`- 前几段已经用过（这段换别的说法）：${recent.join('、')}`)
  const step = ['迎客', '挑逗', '前戏', '正戏', '清洗'][Math.max(0, Math.min(4, o.stepIndex))]
  const length = DENSE_PROMPT_LENGTH
  const gate = o.climaxAllowed
    ? '本回合有人到了高潮档：高潮类的词（白浊 / 潮水…）可以用，写在已经高潮的那个人身上'
    : `本回合没有人到高潮：不写射精、白浊、喷发、潮吹、绝顶——浓度加在「${step}」这一步此刻的动作上`
  const exemplar = DENSE_EXEMPLARS[Math.abs(o.seed) % DENSE_EXEMPLARS.length]
  return `【★重油文风（最后的文风指令，压过前面「分三到五段」之类的篇幅和分段说法；不压过这一步的强度上限、高潮闸门）★】
重油 = 镜头贴着身体走，一拍一拍写满，人物一直在出声。不是做填词题。
- ${gate}
- 「${step}」这一步没给的部位与动作不要提前写（前戏不插入，迎客/挑逗不碰性器），但这一步之内要写透：围着这一回合的动作打转，一个动作拆成几拍慢慢写。
【写法】
1. 分段：叙述段和台词行交替，叙述段 ${densParas(length.max)} 个，一段一拍：动作、部位近景、她的反应。台词可以单独一行，夹在叙述段之间。不写总结段，不写「她感到无比……」。
2. 台词约占正文四分之一。每个在场的姑娘都要开口，自称、说话习惯、性格都保留；台词里夹喘息和拟声，用「……」「——」「～」「❤」断开。
3. 一拍的写法：动作落到具体部位 → 部位近景（形状、颜色、湿度、温度、气味里挑两三样）→ 声音或一句台词。部位前的修饰可以连成长串，在主部位上用，次要部位一笔带过。
4. 拟声要具体，写清是什么发出的：咕啾的水声、肉体拍打的啪嗒声、吸吮的滋溜声。激烈处可以写一句几种声音混在一起。
5. 节奏逐段加码：先看、再碰、再加力，身体反应一段比一段失控。结尾停在一句台词或一个正在进行的动作上，不收束、不总结。
6. 气味和体液要落地：落在哪、沾到哪、留下什么痕迹。
7. 正文 ${length.min}–${length.max} 字。下面词库是调色板，挑贴切的用，大约用上一半就够，不要为凑词硬塞。仍然遵守【文风禁令】黑名单。
【本回合词库（调色板，每回合换一批）】
${rows.join('\n')}
【结构示例（原创，只示范「动作 → 台词 → 反应」的节拍，不是范文）】
${exemplar}
不要复用示例里的任何句子、台词或比喻，人名、部位、动作和台词都按本回合重新写。`
}

/** 重油的每回合硬性要求（接在玩家消息后） */
export const DENSE_TURN_NOTE = `

【本回合硬性要求（重油）】
1. 正文 ${DENSE_PROMPT_LENGTH.min}–${DENSE_PROMPT_LENGTH.max} 字，超过 ${DENSE_PROMPT_LENGTH.max} 字不合格。正文写够就停，最后一句正文是台词。
2. 叙述段和台词行交替，叙述段 6 到 8 个，每段 50–80 字。
3. 台词约占正文四分之一：每个叙述段后面跟一行台词，6 到 8 行，每行 20–50 字，带喘息和拟声，保留各人的说话习惯。叙述段写短一点，把字数让给台词。
4. 围着这一步写，不提前推进，不越过高潮闸门。不要复用示例句子。
5. 正文之后必须照常附 STATS 与 ACTIONS 两行（不计入字数，绝不能省略）。`
