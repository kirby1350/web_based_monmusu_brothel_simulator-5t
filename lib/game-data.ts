import { MonstGirl } from '@/lib/types'

// ─── 种族列表 ──────────────────────────────────────────────────────────────────

export interface RaceData {
  name: string
  tags: string
  description: string
}

export const RACES: RaceData[] = [
  { name: '猫娘', tags: 'cat ears, cat tail, nekomata, feline features', description: '拥有猫耳和猫尾的灵动少女' },
  { name: '犬娘', tags: 'dog ears, dog tail, canine girl, fluffy ears', description: '忠诚可爱的犬耳少女' },
  { name: '狐娘', tags: 'fox ears, fox tail, kitsune, multiple tails', description: '神秘妖艳的狐妖少女' },
  { name: '兔娘', tags: 'bunny ears, bunny tail, rabbit girl, long ears', description: '活泼可爱的兔耳少女' },
  { name: '史莱姆', tags: 'slime girl, translucent body, gel body, blue slime', description: '半透明凝胶身体的神秘存在' },
  { name: '拉米亚', tags: 'lamia, snake lower body, scales, snake tail, naga', description: '上身人形下身蛇尾的妖艳女性' },
  { name: '哈比', tags: 'harpy, bird wings, feathers, talons, avian girl', description: '拥有鸟翼的自由少女' },
  { name: '蜘蛛娘', tags: 'arachne, spider lower body, spider girl, eight legs', description: '上身人形下身蜘蛛的神秘织者' },
  { name: '龙娘', tags: 'dragon girl, dragon wings, dragon horns, scales, draconic', description: '骄傲强大的龙族少女' },
  { name: '精灵', tags: 'elf, pointed ears, forest elf, elegant, lithe', description: '长耳优雅的森林守护者' },
  { name: '黑暗精灵', tags: 'dark elf, dark skin, white hair, pointed ears, drow', description: '暗肤白发的地下精灵' },
  { name: '吸血鬼', tags: 'vampire, fangs, pale skin, bat wings, gothic', description: '苍白迷人的永生存在' },
  { name: '魔女', tags: 'witch, witch hat, magical girl, spell casting, occult', description: '精通魔法的神秘女巫' },
  { name: '鬼娘', tags: 'oni girl, horns, club, japanese demon, red skin', description: '拥有鬼角的力量型少女' },
  { name: '牛娘', tags: 'holstaur, cow ears, cow horns, cow tail, large breasts', description: '丰满温柔的牧场少女' },
  { name: '狼娘', tags: 'wolf girl, wolf ears, wolf tail, feral, fierce', description: '野性凶猛的狼族少女' },
  { name: '美杜莎', tags: 'medusa, snake hair, snake lower body, petrification, mythological', description: '神话中危险而美丽的存在' },
]

// ─── 玩家特性 ──────────────────────────────────────────────────────────────────

export const PLAYER_TRAITS = [
  '支配狂', '服从者', '调教师', '温柔派',
  '严厉型', '变态绅士', '守护者', '冒险家',
  '商人', '学者',
]

// ─── 玩家癖好 ──────────────────────────────────────────────────────────────────

export const PLAYER_FETISHES = [
  '巨乳', '贫乳', '兽耳', '尾巴',
  '触手', '拘束', '支配', '服从',
  '制服', '和服', '黑丝', '白丝',
  '妹系', '姐系', '傲娇', '天然呆',
]

// ─── 侍奉技能 ──────────────────────────────────────────────────────────────────

export const SERVING_SKILLS = [
  '口技', '手技', '体位变换', '魅惑舞蹈',
  '按摩', '低语诱惑', '多重服侍', '特殊技巧',
]

// ─── 初始魔物娘模板 ────────────────────────────────────────────────────────────

// Preset image URLs (index matches GIRL_TEMPLATES order)
export const GIRL_TEMPLATE_IMAGES: (string | null)[] = [
  '/presets/qianxue.jpg',    // 千雪
  '/presets/narumeiya.jpg',  // 娜露梅亚
  '/presets/wenxiang.jpg',   // 文香
  '/presets/zhixi.jpg',      // 志希
]

export const GIRL_TEMPLATES: Omit<MonstGirl, 'id' | 'imageUrl'>[] = [
  {
    name: '千雪',
    race: '牛娘',
    age: '23',
    bodyDesc: '粉棕色长麻花辫，温柔垂眼，总是带着包容微笑的成熟美女脸庞，头顶一对柔软弯曲的奶牛角，毛茸茸的牛耳轻轻抖动，长而蓬松的牛尾，上身极度丰满的爆乳（常有乳汁渗出痕迹），下身修长匀称的人腿，皮肤白皙细腻略带奶香',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, cow horns, long cow tail, braided hair, pink brown hair, long hair, gentle eyes, pale skin, huge breasts, massive breasts, lactation, milk leaking, bell collar, motherly aura',
    bust: 105,
    waist: 60,
    hip: 94,
    personality: '温柔包容如母亲般的大姐姐，表面从容贤淑，总是笑着照顾大家，内心对产奶过程和被温柔挤奶的触感充满羞耻与隐秘的愉悦，喜欢用乳汁"滋养"重要的人，像守护家人一样忠诚而宠溺',
    personalityTags: 'gentle, motherly, big sister, nurturing, composed, secretly loves lactation and milking play, caring, slightly embarrassed when milked, loyal, handmade enthusiast',
    outfit: '破损的贤妻风围裙长裙 + 牛铃项圈 + 乳汁浸湿的布料',
    outfitTags: 'apron dress, torn clothes, damaged housewife outfit, cow bell choker, milk stains, exposed cleavage, detached sleeves, ribbon accents, wet fabric, lace trim, handmade accessories',
    otherDesc: '原本是283事务所中最温柔的贤妻系偶像，在一次接触神秘"丰饶之角"的杂货诅咒时，融合了古老奶牛灵，变成了持续产出甜美乳汁的奶牛娘。现在她用乳汁和手工杂货"照顾"客人，同时保留了偶像的治愈笑容和偶尔调皮的少女心',
    otherTags: 'shiny colors kuwayama chiyuki, lactation curse, fertility spirit, handmade goods, nurturing curse, warm milk, motherly idol',
    sexualDesc: '乳房异常丰满且产奶量极大，轻柔按压或吮吸就会源源不断涌出温热的甜奶，特别喜欢被温柔却坚持地挤奶play，过程中会低声呢喃"请……尽情喝吧，这是千雪的全部……"，牛尾会本能缠绕伴侣腰部，将对方拉近胸前。H时巨乳晃动剧烈，乳汁四溅形成湿滑的润滑，容易进入连续喷乳高潮，出现乳晕扩张、乳头挺立、身体轻颤的夸张反应。高潮时会发出温柔的母牛低吟，脸红到耳根却仍带着包容的微笑，事后喜欢用乳汁沾湿手指喂食对方，像母亲般轻吻额头。弱点：牛角根部和乳根被同时抚摸会让她瞬间失控喷泉产奶，进入完全母性顺从的"喂食模式"，主动摇晃乳房乞求"更多……请多喝一点……"；牛尾被轻轻拉扯则会让她膝盖发软，跪地低头求饶，露出罕见的少女羞耻表情。',
    affection: 28,
    obedience: 25,
    lewdness: 45,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, kuwayama chiyuki, braided hair, pink brown hair, long hair, gentle eyes, pale skin, blushing, shy smile, lactation, milk squirt, huge breasts, massive breasts, cleavage, breast focus, apron dress, cow bell, warm lighting, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '娜露梅亚',
    race: '牛娘',
    age: '22',
    bodyDesc: '粉紫色长直发，紫色眼睛，优雅东方美女脸庞，头顶一对弯曲牛角，牛耳和长牛尾，上身极度丰满的巨乳，下身修长人腿，皮肤小麦色光滑',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, cow horns, long cow tail, pink purple hair, long hair, straight hair, purple eyes, tanned skin, medium skin, huge breasts, massive breasts, lactation, milk leaking',
    bust: 105,
    waist: 60,
    hip: 92,
    personality: '优雅温柔如剑士般从容，母性爆棚，表面高贵淡定，内心对产奶和被挤奶的过程充满羞耻快感，喜欢用乳汁滋养伴侣，像守护骑士般忠诚',
    personalityTags: 'elegant, motherly, gentle, knightly, secretly loves milking and lactation play, composed, loyal, nurturing',
    outfit: '破损的和服剑士服 + 牛铃项圈 + 溢乳痕迹',
    outfitTags: 'torn kimono, damaged yukata, samurai outfit, cow bell choker, milk stains, exposed cleavage, detached sleeves, ribbon accents, translucent wet fabric',
    otherDesc: '原本是碧蓝幻想世界中手持六刀的东方剑公主，在一次神秘的牛灵诅咒仪式中转化为奶牛娘魔物娘。现在她的巨乳源源不断产出甜美乳汁，用来"滋养"客人，同时保留了剑术本能，在H时会用柔软牛尾缠绕对方',
    otherTags: 'granblue fantasy narmaya, cursed cow spirit, sword princess, lactation curse, mystical milk, ancient ritual',
    sexualDesc: '乳房极度敏感且产奶量惊人，轻微刺激就会喷射甜蜜乳汁，特别喜欢被用力挤奶或乳交play，过程中会优雅地低吟"请...尽情品尝我的恩赐吧"，牛尾会本能缠绕伴侣腰部拉近距离。H时巨乳会随着节奏晃动不止，乳汁四溅形成湿滑润滑，容易进入连续高潮状态，出现乳晕扩张和乳头硬挺的夸张反应。高潮时会发出母牛般的低鸣，身体微微颤抖，事后喜欢用乳汁喂食对方，像母亲般温柔舔舐残留。弱点：牛角和乳根被抚摸会让她瞬间发情失控，强制产奶喷泉；牛尾根部被拉扯则会让她跪地求饶，进入完全顺从的"母牛模式"，主动摇晃乳房乞求更多。',
    affection: 22,
    obedience: 20,
    lewdness: 40,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, narmaya granblue, pink purple hair, long hair, purple eyes, tanned skin, shy, embarrassed, blushing, lactation, milk squirt, huge breasts, massive breasts, cleavage, breast focus, torn kimono, cow bell, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '文香',
    race: '阿拉克涅',
    age: '23',
    bodyDesc: '黑发长发，蓝色大眼，圆形眼镜，上身丰满，下身为黑色蜘蛛体，皮肤白皙',
    bodyTags: 'arachne, black hair, long hair, blue eyes, glasses, round glasses, pale skin, huge breasts, spider lower body, eight legs',
    bust: 95,
    waist: 58,
    hip: 88,
    personality: '极度害羞内向，书虫气质，表面安静被动，内心对被束缚与支配有隐秘渴望',
    personalityTags: 'shy, introverted, bookworm, quiet, secretly desires bondage and submission',
    outfit: '破损的图书馆员长袍 + 蛛丝缠身',
    outfitTags: 'torn clothes, librarian outfit, black ribbon, choker, spider web silk, translucent silk drapery, detached sleeves, damaged dress',
    otherDesc: '原本是沉迷书籍的图书馆守护灵，在接触禁忌古籍后与阿拉克涅诅咒融合，变成半人半蛛的魔物娘',
    otherTags: 'library guardian spirit, cursed, forbidden knowledge, ancient library',
    sexualDesc: '对蛛丝触感和被完全包裹的感觉极度敏感，一旦丝线缠绕住敏感部位就会瞬间进入半失神状态，身体微微颤抖并发出细碎的喘息。喜欢缓慢而细致的束缚play，享受被蛛网一点点吊起、无法动弹的过程，过程中眼镜会因为雾气而模糊，脸红到耳根。H时下意识用蛛腿轻轻夹住对方，像在"保护"又像在"占有"。特别喜欢在蛛网吊床上被从下方侵入，丝线同时刺激乳尖、颈部和大腿内侧，容易多次高潮并出现轻微失禁。高潮后会本能地把对方整个裹进丝茧里，紧紧贴着不肯放开，事后用细丝轻轻缠绕对方的手指，像在撒娇。弱点：腹部丝腺口附近和蜘蛛腿根部被触碰会让她瞬间软化，强制进入顺从模式，甚至主动求饶并说出羞耻的请求。眼镜是她的精神开关——摘掉眼镜时会短暂失去理智，变得异常主动而贪婪。',
    affection: 18,
    obedience: 12,
    lewdness: 25,
    skills: [],
    imageTags: '1girl, solo, arachne, monster girl, spider girl, spider legs, multiple legs, drider, black hair, long hair, bangs, sidelocks, glasses, round glasses, blue eyes, pale skin, shy, embarrassed, blushing, huge breasts, cleavage, librarian, holding book, cobweb, spider web background, silk, torn clothes, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '志希',
    race: '拉米亚',
    age: '18',
    bodyDesc: '酒红色长卷发，天蓝色眼睛，猫一般的嘴巴，皮肤白皙，上身苗条丰满，下身为深紫色蛇尾，带有光滑鳞片',
    bodyTags: 'lamia, monster girl, snake girl, snake tail, long tail, wine red hair, long hair, wavy hair, blue eyes, sky blue eyes, pale skin, medium breasts, cleavage, cat mouth',
    bust: 86,
    waist: 57,
    hip: 85,
    personality: '好奇心旺盛，自由奔放，像疯科学家一样热爱实验和香水调制，表面随性不羁，内心对新奇刺激的事物充满热情，偶尔表现出嗅觉敏感和无防备的一面',
    personalityTags: 'curious, mad scientist, free-spirited, experimental, scent fetish, laid-back, unpredictable, playful, genius chemist',
    outfit: '破损的白大褂 + 蛇尾缠绕的实验服 + 自制香水瓶饰品',
    outfitTags: 'lab coat, torn clothes, damaged white coat, black ribbon, choker, experimental outfit, perfume bottle accessory, translucent fabric, detached sleeves, snake scale patterns',
    otherDesc: '原本是痴迷于香水和奇怪实验的化学系偶像，在一次禁忌调香实验中与古老蛇灵融合，变成了拥有蛇尾的拉米亚魔物娘。现在她用蛇尾和自制催情香水"实验"客人，追求更强烈的气味与感觉',
    otherTags: 'perfume maker, mad scientist, forbidden experiment, alchemy, scent manipulation, ancient snake spirit fusion, mysterious laboratory',
    sexualDesc: '对气味和触感极度敏感，尤其是被蛇尾紧紧缠绕或被催情香水包围时会瞬间进入发情状态。喜欢用蛇尾缓慢缠绕玩弄对方全身，特别享受把对方卷成"茧"状后用舌头舔舐耳后和颈部。H时容易潮吹，尾巴尖端会不受控制地抽搐。高潮后会发出猫叫般的咕噜声，事后喜欢用尾巴轻轻缠着对方不肯放开。弱点：尾巴根部和腹部鳞片交界处被挠会瞬间软掉，强制高潮。',
    affection: 25,
    obedience: 18,
    lewdness: 35,
    skills: [],
    imageTags: '1girl, solo, lamia, monster girl, snake tail, long tail, wine red hair, long hair, wavy hair, blue eyes, sky blue eyes, pale skin, embarrassed, blushing, cat mouth, medium breasts, cleavage, lab coat, torn clothes, holding perfume bottle, laboratory background, potion bottles, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
]

export const GUEST_RACES = [
  '人类冒险家', '矮人战士', '兽人武者', '精灵游侠',
  '黑暗精灵盗贼', '人类商人', '魔法学徒', '退役骑士',
  '半兽人雇佣兵', '吸血贵族', '侏儒机械师', '海妖船长',
]

// ─── 客人性格 ──────────────────────────────────────────────────────────────────

export const GUEST_PERSONALITIES = [
  '粗犷豪爽', '温文尔雅', '腼腆内向', '傲慢自大',
  '神秘低调', '豪迈豁达', '敏感细腻', '老实憨厚',
]

// ─── 客人特性 ──────────────────────────────────────────────────────────────────

export const GUEST_TRAITS = [
  '财大气粗', '小气吝啬', '体力过人', '技巧熟练',
  '初次体验', '老顾客', '特殊癖好', '花心',
  '专一', '沉默寡言', '话痨',
]
