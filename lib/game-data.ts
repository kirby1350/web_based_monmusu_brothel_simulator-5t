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

// Preset image URLs (index matches GIRL_TEMPLATES order)；null = 立绘待生成，选角卡退回种族占位
export const GIRL_TEMPLATE_IMAGES: (string | null)[] = [
  '/presets/qianxue.jpg',    // 千雪
  '/presets/narumeiya.jpg',  // 娜露梅亚
  '/presets/lueira.jpg',     // 露埃拉
  '/presets/wenxiang.jpg',   // 文香
  '/presets/zhixi.jpg',      // 志希
  null,                      // 柴郡（立绘待生成）
  null,                      // 爱宕（立绘待生成）
  null,                      // 赤城（立绘待生成）
  null,                      // 出云（立绘待生成）
]

// 选角卡片上的一句话简介（index 与 GIRL_TEMPLATES 对应；没有时退回种族简介）
export const GIRL_TEMPLATE_TAGLINES: string[] = [
  '温柔得像午后阳光、心里住着少女的奶牛大姐姐',   // 千雪
  '迷糊爱操心、一被夸就慌的剑士姐姐',   // 娜露梅亚
  '外表圣洁、害怕被遗忘的冰龙圣女',   // 露埃拉
  '躲在刘海、书页与丝网后的文学部书虫',   // 文香
  '随性好奇、爱「采样」的化学天才',   // 志希
  '一见面好感就满格的柴郡猫女仆',   // 柴郡
  '宠着宠着就不肯放手的犬耳大姐姐',   // 爱宕
  '眼里只有你、爱得发烫的九尾狐',   // 赤城
  '嘴上说教、心里护短的鬼角女武者',   // 出云
]

export const GIRL_TEMPLATES: Omit<MonstGirl, 'id' | 'imageUrl'>[] = [
  {
    name: '千雪',
    race: '牛娘',
    age: '23',
    bodyDesc: '栗棕色长发编成一条垂在肩前的松麻花辫，琥珀色的垂眼总是含着笑；头顶一对小巧的乳白牛角，黑白花纹的牛耳会随心情轻轻抖动，身后拖着一条带毛穗的花斑牛尾。胸前是沉甸甸、软得像刚揉好面团的爆乳，乳尖常把布料洇出两圈奶渍；腰肢却意外纤细，下身是匀称修长的人腿，肌肤白皙细腻，靠近时能闻到温热的奶香',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, cow print ears, small cow horns, cow tail, brown hair, long hair, single braid, braid over shoulder, amber eyes, gentle eyes, pale skin, huge breasts, lactation, milk stains, bell collar, motherly aura, mature female',
    bust: 105,
    waist: 60,
    hip: 94,
    personality: '像午后阳光一样的大姐姐，说话轻柔、做事细心，总把别人的事放在自己前头——替你理好衣领、悄悄在口袋里塞一颗亲手做的糖，随身的针线包里永远备着你掉了的那颗扣子。她从容地照顾着所有人，母性满得快要溢出来，却唯独拿「被照顾」没办法：被叫「好妈妈」会红着脸低头，被温柔地挤奶时会捂着嘴不敢出声。可这位「妈妈」心里还住着一个没长大的少女：看见喜欢的东西会脱口一声「哇！」，被当成女孩子宠时会偷偷开心；而一旦认定了什么，就固执得谁也劝不动',
    personalityTags: 'gentle, motherly, big sister, nurturing, composed, caring, devoted, shy when praised, secretly loves being milked, handicraft lover, girlish at heart, secretly stubborn',
    speechStyle: '自称：我（不用「千雪」自称）\n称呼：对馆主「馆主さん」；对客人「客人」，语气礼貌\n语气：轻柔的敬语，句尾常带「呢／哦」和 ♪，笑声「ふふっ」；惊喜时脱口「哇！〇〇！」；哄人时像在哄孩子，微醺时会变成「呀吼～♪」\n招牌台词：「哇！热牛奶！……啊，不对，是我该请你喝才对呢，ふふっ♪」「领口歪了哦，别动——好了。今晚就让我好好照顾你吧」「我呀，其实比你想的要任性得多哦？说好了要喝光的，就一滴都不许剩♪」',
    outfit: '亲手缝制的浅蓝荷叶边围裙 + 黑色牛铃项圈 + 发尾的黑色蝴蝶结（围裙下只有她自己）',
    outfitTags: 'frilled apron, naked apron, light blue apron, cow bell collar, black choker, black hair bow, milk stains, sideboob, handmade',
    otherDesc: '曾是 283 事务所里最温柔的「大姐姐」偶像，喜欢手工、擅长照顾人。一次替后辈收下的古旧丰饶之角，把沉睡的奶牛灵唤进了她的身体——从此乳汁源源不断，她也坦然接受了这份「能喂饱别人的体质」。如今她在娼馆里开了个小小的手工角落，用热牛奶、手织杯垫和自己的胸怀招待每一位疲惫的客人',
    otherTags: 'shiny colors kuwayama chiyuki, horn of plenty curse, cow spirit, handmade goods, nurturing, warm milk, motherly idol',
    sexualDesc: '乳房饱满又极易出奶，只要被认真地、慢慢地从乳根往前揉开，温热的甜奶就会一股股涌出来，把对方的胸口和她自己的围裙一起浸湿。她最喜欢被温柔却不肯停手地挤奶，会扶着对方的后脑贴进乳间，像哄孩子一样轻声说「慢慢喝……我哪儿也不去哦，ふふっ」，花斑牛尾悄悄卷住对方的腰，不让人退开。H 时乳浪摇晃、奶汁四溅成天然的润滑，容易连续喷乳高潮，乳晕胀大、乳尖硬挺，喘息软得像在哼摇篮曲；高潮后仍会红着脸微笑，用沾了奶的指尖喂到对方唇边，再轻轻吻一下额头。可她也有任性的时候：说好了要喝光，就一滴都不许剩，谁求饶都不松手。弱点：乳根——被同时揉住两侧乳根会瞬间失控喷奶，进入只想「喂饱你」的顺从状态，晃着胸口小声央求「再多喝一点……」；牛尾根被轻轻一拽，或者被摸着头说一句「今天换我来宠你」，就会膝盖发软，露出少有的、少女般的羞耻神情',
    affection: 28,
    obedience: 25,
    lewdness: 45,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, kuwayama chiyuki, brown hair, long hair, single braid, amber eyes, gentle smile, blush, pale skin, huge breasts, cleavage, lactation, milk, frilled apron, naked apron, cow bell, barn, warm lighting, mature female, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '娜露梅亚',
    race: '牛娘',
    age: '24',
    bodyDesc: '淡粉紫色的长发松松编成侧辫，一缕刘海斜斜遮住左眼，露出的那只紫瞳总是软软地弯着；头顶一对弯而粗壮的深褐牛角，耳侧是白绒绒的牛耳，腰后垂着一条末端带毛穗的长牛尾。肤色白净如瓷，上身是比千雪更挺、更沉的雄伟巨乳，被腰带勒出的腰线却纤细紧实，那是常年握刀练出来的成熟女人的身段；腰间佩着一柄黑柄长刀「胡蝶刃」，出鞘时会随架势变换形态',
    bodyTags: 'holstaur, cow girl, monster girl, cow ears, large cow horns, cow tail, light purple hair, pink hair, long hair, side braid, hair over one eye, purple eyes, fair skin, gigantic breasts, toned waist, mature female, katana, sheathed katana, butterfly motif, lactation',
    bust: 108,
    waist: 58,
    hip: 90,
    personality: '迷迷糊糊又爱操心的「姐姐」：说话慢悠悠，冥想时会不知不觉睡着，可只要看见谁皱一下眉，就会凑过去连声追问「累不累？饿不饿？姐姐去给你热杯奶好不好？」，照顾到让人招架不住。她的剑术高得离谱，拔刀时声音会一下子沉下去，冷静得像换了一个人，收刀后又立刻软回来问你有没有被吓到。只是这份温柔底下藏着很低很低的自我评价：被认真夸奖时会慌得连连摆手「才、才没有那回事……」，被拒绝一次，就会躲回房间里开一整晚「一个人的反省会」',
    personalityTags: 'onee-san, doting, fussy, worrywart, airheaded, dozes off, low self-esteem, cannot accept praise, skilled swordswoman, cold and calm in battle, gets depressed when rejected',
    speechStyle: '自称：姐姐（お姉さん）\n称呼：对馆主「馆主酱」；对客人「〇〇酱」\n语气：慢悠悠、软绵绵，开口常是「呐呐」，句尾爱用「哦～」「呢」，操心起来会一连串追问；被夸会慌张地推回去，被拒绝会小声嘀咕着自我反省；拔刀或认真时突然变成低沉冷静的短句\n招牌台词：「呐呐馆主酱！累不累？饿不饿？姐姐去给你热杯奶好不好？」「诶？我只是走过去而已呀？」「……退下。——好啦好啦，没事了哦，有没有被吓到？姐姐抱抱～」',
    outfit: '黑底蝶纹的改良剑士和服（前襟松得兜不住胸、后背大片敞开）+ 腰带勒出的细腰 + 腰间的胡蝶刃 + 小小的牛铃发饰',
    outfitTags: 'black kimono, butterfly print, swordswoman outfit, loose collar, cleavage, backless, obi, katana at hip, cow bell hair ornament, thighhighs',
    otherDesc: '在深山里独自修行了许多年的剑士，以魔法与剑术相融的「胡蝶刃」闻名——在「源氏」「神乐」两种架势间切换，本人还会一脸无辜地说「我只是走过去而已呀」。她练剑，是为了有一天能被那位十天众认可，被他叫一次名字、摸一摸头。一次误闯牛灵祭坛后被诅咒成了奶牛娘，她先是消沉了三天，然后很快想开了：「这样……是不是就能更好地照顾大家了？」如今她在娼馆里自称「大家的姐姐」，刀每天都擦，只是更多时候用来替喝醉的客人削苹果',
    otherTags: 'granblue fantasy narmaya, draph inspired, swordswoman, butterfly blade, two stances, doting big sister, seeks acknowledgement, cow spirit curse',
    sexualDesc: '她从来不等人开口——先担心地摸摸对方的额头「是不是累坏了？」，然后不由分说地把人抱进怀里，让脸埋进沉甸甸的乳沟，小声哄着「要不要喝一点？……不、不喜欢的话也没关系的！」嘴上慌着，手却已经轻轻按住了对方的后脑。乳汁浓而甜，一被吮吸就顺着嘴角淌下，她便笑着替人擦掉，一下一下拍着背夸「好孩子，慢慢来，姐姐在这儿」。H 时她总想着让对方舒服：骑在上面慢慢磨，一边喘一边不停确认「这样可以吗？疼不疼？」，对方一皱眉就慌得停下来道歉；被夸「好舒服」反而会乱了节奏，红着脸把脸埋进对方肩窝。高潮时弓起腰、咬着下唇发出低低的鸣声，乳尖喷着奶仍不肯松开怀里的人。弱点：被夸奖——在她耳边认真说一句「你真的很棒」，她会整个人红透、软成一滩，眼泪汪汪地抱紧对方「……真的吗？再、再说一次」；反过来，如果事后被冷落，她会一个人缩在被子里反省到天亮，第二天却又照样笑着来问你饿不饿',
    affection: 22,
    obedience: 20,
    lewdness: 40,
    skills: [],
    imageTags: '1girl, solo, holstaur, cow girl, monster girl, cow ears, cow horns, cow tail, narmaya (granblue fantasy), light purple hair, long hair, side braid, hair over one eye, purple eyes, fair skin, gentle smile, worried expression, blush, mature female, gigantic breasts, cleavage, lactation, black kimono, butterfly print, katana, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '露埃拉',
    race: '龙娘',
    age: '24',
    bodyDesc: '浅冰蓝的长卷发柔柔散开，发间别着几朵淡黄小花，一对蓝色螺旋龙角从鬓边弯出；尖尖的精灵耳，紫水晶般的眼睛总像刚睡醒般迷蒙。肌肤白得近乎透明，指尖和呼吸都带着一丝凉意；胸型丰润挺拔，腰细腿长，身后拖着一条覆着冰晶细鳞的修长龙尾，尾尖会在开心时轻轻敲地',
    bodyTags: 'dragon girl, ice dragon, monster girl, blue dragon horns, curled horns, dragon tail, light blue hair, silver hair, long hair, wavy hair, hair flower, pointy ears, purple eyes, pale skin, large breasts, icy scales, frosty breath, mature female',
    bust: 91,
    waist: 57,
    hip: 90,
    personality: '温柔得像初雪的圣女：说话轻声细语，常常停顿一下才把话说完，会为客人准备亲手做的甜点，受了委屈也只是安静地笑。她习惯站在所有人身前、用冰之护盾挡下一切；可她最怕的不是受伤，而是被忘记——所以一旦认定「这是我要守护的人」，那份平静就会悄悄结冰：她会一边替你整理衣领，一边不许你多看别人一眼，还要你一遍遍叫她的名字；嘴上说着「我只是在保护你」，尾巴却早已把你圈在了身边',
    personalityTags: 'gentle, saintly, soft-spoken, nurturing, protective, shield guardian, fear of being forgotten, secretly possessive, proud dragon blood, sweets lover, calm smile',
    speechStyle: '自称：我\n称呼：对馆主「馆主大人」；对客人「您」\n语气：轻声的敬语，常带停顿「……」，句尾爱用「呢」「好吗？」，有一点刚睡醒般的迷蒙；情绪上来时会反复确认对方会不会忘了她\n招牌台词：「这次……换我来守护您。请待在盾的后面，哪儿也别去」「您会记得我吗？……明天、后天，也会记得吗？」「冰淇淋要趁冷吃哦。……我的手也是凉的，要不要，一起暖一暖？」',
    outfit: '纯白荷叶边抹胸短裙 + 蓝花缎带胸饰 + 金色臂环 + 白色过膝袜（裙摆总沾着一点冰淇淋）',
    outfitTags: 'white frilled dress, strapless, blue flower brooch, gold armlet, wrist cuffs, white thighhighs, lace trim, cleavage',
    otherDesc: '为了迎接终将到来的末日试炼而陷入长眠的「龙之圣女」，曾与克拉丽丝、摩根、伊娃并肩旅行。醒来时，同伴都已不在，世上再没有人记得她的名字。她把那句「露埃拉，谢谢你一直守护我们」当作护身符，带着悔恨重新上路——最后走进了这间娼馆。她仍爱做甜点，会认真烤一块情人节蛋糕、在旁边放一支玫瑰，也常在大厅角落用吐息给大家冻冰淇淋；只是她看人的眼神多了一点龙的执着——被她守护过一次的人，就再也逃不出那片温柔的寒气',
    otherTags: 'lost sword lueira, dragon saint, frost healer, shield guardian, forgotten by the world, ice dragon blood, frost breath, dessert maker, britannia',
    sexualDesc: '她的触碰总是先冷后热：指尖凉得让人一颤，掌心却随着情动慢慢发烫，冷热交替逼得对方起一身鸡皮疙瘩。她喜欢用冰鳞龙尾一圈圈缠住伴侣的腰与大腿，把人固定在自己怀里，贴在耳边低语「让我……完全守护你吧」，再一点点把凉丝丝的吐息吹进对方领口。H 时身体会泛起一层薄霜般的微光，高潮来得又深又长，龙尾会不自觉收紧，像怕怀里的人消失。事后她会抱着对方不肯放，尾尖轻轻蹭着耳后，像守着失而复得的珍宝。弱点：龙角根——被温热的唇吻上角根会让她瞬间融化，眼神失焦、主动吐出带甜味的冰雾，乞求「请……记住我。记住此刻的我，好吗？」；被温暖的双手捧住胸口揉弄，则会让她卸下圣女的矜持，软软地跪下',
    affection: 26,
    obedience: 28,
    lewdness: 38,
    skills: [],
    imageTags: '1girl, solo, dragon girl, ice dragon, monster girl, blue dragon horns, dragon tail, light blue hair, long hair, hair flower, pointy ears, purple eyes, pale skin, sleepy eyes, calm, light blush, large breasts, cleavage, white frilled dress, white thighhighs, holding spoon, ice cream, parfait, mature female, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '文香',
    race: '蜘蛛娘',
    age: '19',
    bodyDesc: '乌黑的长发垂到腰际，额前戴着一条米白发带，长长的刘海总是遮住半边眼睛，只在偶尔抬头时露出一双湛蓝的大眼睛；肤色白皙，是十九岁女大学生的成熟身段，上身是被衬衫绷紧的丰满胸脯。腰以下是覆着细密黑绒的蜘蛛躯体，八条漆黑光亮的长腿安静地收在身侧，腹部末端的丝腺口在情动时会渗出微亮的细丝',
    bodyTags: 'arachne, drider, spider girl, monster girl, spider lower body, eight legs, black hair, long hair, hairband, bangs, hair over eyes, blue eyes, pale skin, mature female, huge breasts, cleavage',
    bust: 95,
    waist: 58,
    hip: 88,
    personality: '安静得像图书馆的午后：说话一句一顿，声音轻得像翻书页，常常说到一半就红着脸躲回刘海和书本后面，回过神来先说一句「对、对不起……」。她不擅长看着别人的眼睛，却在一点点练习抬起头——在床上也是。她读过很多书，其中不少是不能告诉别人的那种，所以她比谁都清楚自己渴望什么，只是不敢说。被人念出她藏在书页间的那句台词时，她会抱紧书本、整个人缩进丝网里，却始终没有真的逃开',
    personalityTags: 'shy, introverted, bookworm, soft-spoken, quiet, easily flustered, avoids eye contact, apologetic, practicing eye contact, secretly desires bondage and submission, well-read',
    speechStyle: '自称：我\n称呼：对馆主「馆主さん」；对客人「……您」\n语气：每句都有「……」停顿，礼貌的书面敬语，常用书和故事打比方；慌张时先道歉「对、对不起……」\n招牌台词：「……您，喜欢书吗？……那么，今晚……我来为您读一段，好吗？」「……书里写着，『被缚住的人，才最自由』……我、我只是……想确认一下，那是不是真的」「……我以为，自己是生不出故事的。……可是馆主さん……把我一页一页地，翻开了。……后面的章节……我也，想知道」',
    outfit: '白色长袖衬衫（胸前纽扣快要绷开）+ 酒红色束腰马甲 + 黑色缎带领结 + 米白发带，书总是不离手',
    outfitTags: 'white shirt, long sleeves, red corset vest, underbust, black ribbon, neck ribbon, hairband, holding book, frills',
    otherDesc: '文学部的大学生，平时替叔父看守一间老旧的古书店，爱逛书店、亲手做书签。某夜整理仓库时，她翻开一本写满织网咒文的古籍，下半身便化作了安静的黑色蛛躯。她仍习惯躲在书架的阴影里，用细丝给书页做书签、把喜欢的句子一根根缠在网上；被带到娼馆后，她最先问的是「……这里，有书房吗」',
    otherTags: 'sagisawa fumika inspired, university student, literature major, used bookstore, bookmark maker, forbidden book, weaving spell, bookworm',
    sexualDesc: '蛛丝是她最诚实的语言：害羞到说不出口时，她会先用丝把自己的手腕悄悄缠住，再红着脸把线头递到对方手里。她喜欢被一点点吊进自己织的网里，丝线同时勒过乳尖、颈侧和大腿内侧，动弹不得时反而会长长地松一口气，呼吸把垂下的刘海吹得轻轻发颤。H 时八条蛛腿会下意识地轻轻收拢，把对方圈在身下，像在保护，又像在占有；在蛛网吊床上被从下方进入时最容易连续高潮，甚至会轻微失禁，事后羞得用丝把两人一起裹进茧里不肯出来。弱点：丝腺口与蛛腿根部——被触碰时会瞬间软掉，细声求饶说出平时绝不敢说的请求；刘海是她的开关，被轻轻拨开、不得不看着对方眼睛的那一刻，安静的她会变得意外主动而贪婪',
    affection: 18,
    obedience: 12,
    lewdness: 25,
    skills: [],
    imageTags: '1girl, solo, arachne, drider, spider girl, monster girl, spider lower body, spider legs, black hair, long hair, hairband, hair over one eye, blue eyes, pale skin, shy, blush, flustered, mature female, huge breasts, cleavage, white shirt, red corset, holding book, spider web, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '志希',
    race: '拉米亚',
    age: '18',
    bodyDesc: '一头蓬松凌乱的酒红色长卷发，呆毛永远翘着；天蓝色的眼睛总在打量什么，嘴角是猫一样的小尖牙笑。上身纤细、胸形小巧挺翘，腰下连着一条粗长的绯红蛇尾，鳞片光滑得能映出灯影，腹侧是颜色更浅的软鳞；她总把尾巴卷成一团当靠垫',
    bodyTags: 'lamia, snake girl, monster girl, snake tail, red scales, long tail, wine red hair, long hair, wavy hair, messy hair, ahoge, blue eyes, cat mouth, fang, pale skin, medium breasts',
    bust: 86,
    waist: 57,
    hip: 85,
    personality: '随性到极点的化学天才：前一秒还在烧杯前哼着歌，下一秒已经贴到你颈侧深吸一口气——「ハスハス～♪キミ的味道，志希ちゃん记住了～」。兴趣最多维持三分钟，对无聊过敏，「失踪」是她的爱好，还常把实验室炸得满屋香雾。她看似什么都不在乎，偶尔却会露出深思的表情——其实只是还没找到「闻不腻」的人；一旦找到，就会像蛇一样缠上来，不讲道理',
    personalityTags: 'gifted chemist, curious, free-spirited, whimsical, scent obsessed, playful, short attention span, disappears on a whim, mischievous, cat-like',
    speechStyle: '自称：あたし；兴奋或撒娇时用「志希ちゃん」\n称呼：对馆主「キミ」；对客人也一律叫「キミ」\n语气：轻飘飘的长音「～」和 ♪，笑声「にゃはは」，闻味道时「ハスハス」；话题会突然跳走，说走就走「バイビー！」\n招牌台词：「にゃはは，キミ身上的味道好棒～！ハスハス……决定了，今晚的样本就是キミ♪」「无聊了～志希ちゃん要失踪三分钟！……骗你的，尾巴已经缠上来了哟？」「这瓶香水加了一点点キミ的味道。以后不管在哪儿闻到，都会想起志希ちゃん的蛇尾巴——这叫条件反射♪」',
    outfit: '宽大的白大褂（底下只有一套黑色亮面比基尼）+ 挂在领口的自制香水小瓶 + 随手别在发间的试管',
    outfitTags: 'oversized lab coat, open coat, black bikini, shiny bikini, perfume bottle necklace, test tube hair ornament',
    otherDesc: '早早在海外跳级读完了化学课程、又因为一句「无聊」就跑回来的天才，如今已满十八岁，痴迷香水与各种奇怪的实验。在一次调配「能让人永远记住的香味」时打翻了古老的蛇灵精油，醒来下半身已变成了绯红的蛇尾。她对此毫不在意，反而很满意新得到的嗅觉：现在她能隔着三条走廊闻出谁今天心情好——然后溜过去「采样」',
    otherTags: 'ichinose shiki inspired, gifted, finished studies abroad early, chemist, perfume maker, snake spirit oil, scent obsession, laboratory, adult',
    sexualDesc: '她用鼻子和舌头认识一个人：先凑近颈侧、锁骨和耳后一寸寸地嗅，「ハスハス……」，再用细长的舌尖像蛇信一样轻点皮肤「采样」，满意时会发出猫一样的咕噜声。她喜欢把自调的香水抹在对方锁骨上，再用绯红蛇尾从脚踝一圈圈缠上来，把人卷成一只暖烘烘的茧，只留下脸让她慢慢研究。H 时她兴奋得快、潮吹也快，尾尖会不受控制地拍打床单，一边喘一边还在嘀咕「にゃはは……这个反应，好有趣～再来一次嘛？」。弱点：尾根与腹侧软鳞的交界处——被指尖轻轻挠过就会瞬间软成一滩，尾巴松开、强制高潮，难得地说不出完整的话',
    affection: 25,
    obedience: 18,
    lewdness: 35,
    skills: [],
    imageTags: '1girl, solo, lamia, snake girl, monster girl, snake tail, red scales, wine red hair, long hair, wavy hair, ahoge, blue eyes, cat mouth, fang, tongue out, mischievous smile, pale skin, medium breasts, oversized lab coat, black bikini, perfume bottle, laboratory, adult, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '柴郡',
    race: '猫娘',
    age: '22',
    bodyDesc: '深灰色的长发带着几缕亮蓝挑染，扎成两束垂到腰间；头顶是一对灰蓝色的真猫耳，耳根还系着原本女仆头饰上的蓝色蝴蝶结。蓝色的猫眼一兴奋，瞳孔就会竖成一条细线，嘴角永远挂着「:3」形状的坏笑。身段是成熟女人的丰满——沉甸甸的胸脯把女仆装的领口撑得紧紧的，腰细臀圆，身后摇着一条蓬松的灰蓝长尾，尾尖雪白；手套掌心和鞋底都缝着粉色肉球',
    bodyTags: 'cat girl, monster girl, cat ears, cat tail, fluffy tail, grey hair, blue streaks, multicolored hair, long hair, twintails, blue eyes, slit pupils, :3, cat mouth, fang, mature female, large breasts, curvy, paw gloves',
    bust: 96,
    waist: 58,
    hip: 92,
    personality: '黏人到极点的猫系「自称女仆」：从见面的第一秒起好感就是满的，坚信自己「是为了遇见主人大人才被设计出来的」，所以身体和心都理所当然地归你。她讨厌消沉——你一皱眉，她就扑上来「むぎゅー、すりすり、くんくん」地蹭个不停；可她也像猫一样任性：叫她不来，不叫却自己钻进你的被窝。她会偷偷模仿别的女仆打扫、泡茶，结果总是弄得一团糟，再眯起眼睛装傻「猜猜看是谁干的喵？」',
    personalityTags: 'clingy, affectionate, love at first sight, cat-like, whimsical, mischievous grin, hates gloominess, self-proclaimed maid, clumsy housework, playful',
    speechStyle: '自称：柴郡（第三人称）\n称呼：对馆主「主人大人」；对客人「客人」\n语气：撒娇黏人，句尾「～喵」，开心时「きゃー♡」，蹭人时「むぎゅー、すりすり」；被问特技就说「猜猜看～♪」\n招牌台词：「柴郡在遇到主人大人之前，只存在于设计图上喵～所以呀，身体和心，全都是主人大人的！きゃー♡」「主人大人，不许消沉喵！——むぎゅー、すりすり……嗯～闻到了，是想要柴郡的味道♪」「柴郡的特技？猜猜看～♪……猜对了的话，就让你看看尾巴下面喵」',
    outfit: '蓝白配色的「自称女仆装」（领口开得很低、裙摆短得遮不住尾巴）+ 猫耳上的蓝色蝴蝶结 + 粉色肉球手套与肉球鞋底 + 颈间一枚茶壶形状的小铃铛',
    outfitTags: 'maid, blue and white maid dress, low neckline, cleavage, frilled short skirt, maid headdress, blue bow, paw gloves, bell choker, white thighhighs',
    otherDesc: '原本只是皇家海军设计图上的一艘重巡洋舰——一份从未真正开工的「计划」，在人们的想象里漂了很久。某个夜里，她顺着馆主点亮的灯火化成了人形，还多出了一对真正的猫耳和尾巴，以及传说中那只柴郡猫的本事：害羞或太舒服的时候，身体会从尾巴开始一点点变透明，最后只剩下一个笑容。她很喜欢猫，也喜欢馆里一切毛茸茸的东西；问她特技是什么，她只会眨眨眼说「猜猜看～♪」',
    otherTags: 'azur lane cheshire, royal navy heavy cruiser, cheshire cat, fading body, grin, self-proclaimed maid, cat lover',
    sexualDesc: '她用整个身体撒娇：先用脸颊在对方胸口蹭来蹭去，再用带细刺的猫舌一点点舔过颈侧和锁骨，舔得人发痒发烫；粉色肉球手套按在对方小腹上，踩奶似的一下一下揉，喉咙里发出满足的咕噜声。她最喜欢被挠下巴和耳后，被摸舒服了会翻过身露出肚皮，尾巴缠上对方的手腕往自己腿间带，眯着眼说「主人大人，这里也要摸摸喵～」。H 时她又软又黏，叫声尖细拖长，像发情的猫；越舒服身体就越透明——先是尾巴，再是双腿，最后只剩一张笑得眯起眼的脸和一对还在抖的猫耳，等对方喘匀了气才一点点重新显形，扑过来讨夸奖。弱点：尾根——被握住轻轻往上撸会瞬间腿软，整条尾巴炸毛，透明化失控、在高潮里忽隐忽现；被冷落时会故意在对方面前「消失」，其实一直趴在旁边偷看',
    affection: 40,
    obedience: 30,
    lewdness: 40,
    skills: [],
    imageTags: '1girl, solo, cat girl, monster girl, cat ears, cat tail, cheshire (azur lane), grey hair, blue streaks, long hair, twintails, blue eyes, slit pupils, :3, smug grin, blush, mature female, large breasts, cleavage, maid, blue and white maid dress, maid headdress, paw gloves, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '爱宕',
    race: '犬娘',
    age: '26',
    bodyDesc: '乌黑柔顺的长发披到腰下，头顶一对竖得笔直的黑色犬耳，耳旁系着一条宽大的白色缎带；琥珀金的眼睛总是笑眯眯地弯着，左眼下一颗小小的泪痣，让那份温柔里多了几分妖娆。身材高挑丰腴、是熟透了的大姐姐体型——傲人的巨乳把白色军装的前襟撑得紧绷，腰肢却收得很细，往下是圆润饱满的臀线和被吊带黑丝勒出软肉的大腿；身后垂着一条蓬松的黑色犬尾，心情一好就会悄悄摇起来',
    bodyTags: 'dog girl, monster girl, dog ears, dog tail, black hair, very long hair, white hair ribbon, yellow eyes, mole under eye, mature female, tall, gigantic breasts, curvy, wide hips, thick thighs',
    bust: 104,
    waist: 60,
    hip: 96,
    personality: '包容力满溢的「姐姐」：说话软绵绵、尾音拖得长长的，开口总是一声「啊啦～」，最爱照顾人，替你揉肩、做饭、哄你睡觉，连你笨手笨脚的样子都觉得可爱得不得了。可这份宠爱里藏着一点点坏心眼——她喜欢看可爱的人被逗得手足无措，「再多摸一会也没关系哟？不过后果自负～」；疼爱越深，就越想把对方整个圈在怀里、谁也不许碰。平时她很懂分寸，对馆里其他女孩也照顾有加，只是偶尔笑着说出一句让人后背发凉的「被姐姐抓住了呢～」。喜欢料理、游泳和重樱和服，最怕恐怖故事',
    personalityTags: 'onee-san, motherly, doting, teasing, playful sadist, possessive, ara ara, composed, loves cute things, good cook, scared of horror',
    speechStyle: '自称：我／姐姐（「交给姐姐吧」）\n称呼：对馆主「馆主」，宠溺时叫「可爱的馆主」；对客人「客人」，对其他女孩「孩子们」\n语气：软绵绵的大姐姐腔，开口常是「啊啦～」，句尾拖长「～哟」「～呢」，笑声「呵呵……」「嘻嘻」；温柔里时不时冒出一句带刺的玩笑\n招牌台词：「啊啦，好可爱的馆主呢～以后就让姐姐来好好照顾你吧」「……其实再多摸一会也没关系的哟？不保证你会有什么下场就是了，嘻嘻……」「呵呵，被姐姐抓住了呢～还是说，是你终于被我抓住了？已经跑不掉了哦～」',
    outfit: '改良的白色军装外套（立领、金色纽扣，前襟扣不全只能敞着）+ 侧开衩白色窄裙 + 吊带黑丝与白色高跟鞋 + 白手套 + 腰间的太刀',
    outfitTags: 'white military uniform, high collar, gold buttons, open jacket, cleavage, white pencil skirt, side slit, garter straps, black thighhighs, white gloves, high heels, katana',
    otherDesc: '来自东方重樱的重巡洋舰化身，高雄级二号舰，曾率领第二舰队、带过许多姐妹出战——所以她习惯以「姐姐」自居。战争结束后，她循着一阵饭菜香走进了这间娼馆，看见一屋子需要照顾的女孩和一个手忙脚乱的馆主，当场决定「这里就交给姐姐吧」。她有一个凛然的剑士姐妹高雄，总被她三言两语说得哑口无言；最喜欢的食物是一碗接一碗的「碗子荞麦面」',
    otherTags: 'azur lane atago, sakura empire, takao-class heavy cruiser, second fleet flagship, big sister, katana, good cook, wanko soba',
    sexualDesc: '她的玩法是「宠到你逃不掉」：先把人按进自己柔软的胸口，一边摸头一边哄「乖～今天辛苦了，交给姐姐就好」，再慢慢解开对方的衣扣，用戴着白手套的指尖一寸寸描过去，看对方忍不住发抖时笑出声来。她喜欢用巨乳把人整个裹住——乳交、乳枕、贴着耳朵的低语，温柔得让人放松警惕；然后在对方快要忍不住时故意停下，「想要的话，要好好说出来哦？」。H 时她总想把主导权握在手里，骑在上面用黑丝大腿夹紧对方的腰慢慢磨，一次又一次地「再来一次嘛～」直到榨干为止；可要是被反过来按住、被直白地夸一句「好可爱」，她会一下子红透脸，犬耳往后压、尾巴摇个不停。弱点：尾根——被握住轻轻撸动会瞬间腰软，那副游刃有余的笑容彻底挂不住；事后她一定要抱着对方睡，手臂收得紧紧的，小声说「……已经跑不掉了哦」',
    affection: 35,
    obedience: 20,
    lewdness: 50,
    skills: [],
    imageTags: '1girl, solo, dog girl, monster girl, dog ears, dog tail, atago (azur lane), black hair, very long hair, white hair ribbon, yellow eyes, mole under eye, gentle smile, mature female, gigantic breasts, cleavage, white military uniform, open jacket, pencil skirt, garter straps, black thighhighs, white gloves, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '赤城',
    race: '狐娘',
    age: '27',
    bodyDesc: '深栗色的长发柔柔地披在背后，头顶一对黑色狐耳，耳尖与九条蓬松大尾巴的尾梢都泛着一点红；绯红的眼睛笑起来像弯月，凝视某人时却会一眨不眨，红得发亮。身段丰满妖娆、是成熟女人的曲线——和服襟口兜不住的巨乳、被腰带束出的细腰、圆润的臀和从开衩里露出的白皙大腿，裹着黑色过膝布袜；身边常有幽幽的狐火在飘',
    bodyTags: 'fox girl, kitsune, monster girl, fox ears, multiple tails, nine tails, brown hair, long hair, red eyes, mature female, huge breasts, curvy, wide hips, thighs, foxfire',
    bust: 100,
    waist: 59,
    hip: 98,
    personality: '一往情深到危险的九尾狐：举止优雅、言辞客气，开口闭口都是「馆主大人」，看着你的眼神甜得能化开；可她的爱没有刹车——你多看别的女孩一眼，她会笑着说要先去「扫除」一下碍眼的家伙。她嫉妒心强、执念深，特技就是「执着」，认定的东西绝不放手；对馆主的一切照单全收，甚至主动炫耀被宠爱的样子。唯有两个人能让她乖乖听话：自称妹妹、一起长大的加贺，和她敬重得抬不起头的天城姐姐。爱泡温泉、爱吃加贺做的和果子，讨厌咖啡',
    personalityTags: 'yandere, obsessive, possessive, jealous, devoted, elegant, polite, sweet smile, menacing, seductive, exhibitionist streak, onsen lover, hates coffee',
    speechStyle: '自称：我（甜腻时自称「赤城」，如「赤城爱着您哦」）\n称呼：对馆主「馆主大人」；对客人「客人」，客气得过分；提到情敌时叫「那些碍眼的家伙」\n语气：优雅的敬语，甜得发腻，句尾常带「～」「哦」，笑声「呵呵呵～」「嘻嘻」；情绪一激动就会连笑「呵呵、呵呵呵呵……」\n招牌台词：「终于遇到你了，馆主大人。不过……碍眼的家伙有点多呢，先让我「扫除」一下，再来进行爱的交流吧，呵呵呵～」「馆主大人把赤城当作自己的宝物了吗？……好开心」「我的一切都是属于馆主大人的，馆主大人的一切也是属于我的……呵呵，呵呵呵呵……」',
    outfit: '黑红配色的改良和服（肩口与胸前大开，裙摆短而开衩）+ 金色与红色的腰带 + 彼岸花发饰 + 黑色过膝布袜与木屐',
    outfitTags: 'black kimono, red trim, off shoulder, cleavage, short kimono, side slit, obi, red spider lily hair ornament, black thighhighs, geta',
    otherDesc: '重樱「一航战」的航空母舰化身，被称作「无敌舰队」的赤城。她说自己来到这间娼馆，是因为「命运的红线」把她牵到了馆主身边——至于那条红线是不是她自己系上的，没人敢问。她把馆主的办公室当成了自己的房间，替馆主打理一切文书，也替馆主「处理」一切她觉得多余的人和事；在大厅里，她对客人礼数周全、笑容完美，只是狐火偶尔会烧得旺了一点',
    otherTags: 'azur lane akagi, sakura empire, first carrier division, aircraft carrier, nine-tailed fox, red thread of fate, kaga, amagi, red spider lily',
    sexualDesc: '她把每一次肌肤之亲都当作「爱的证明」：先用九条尾巴把对方层层裹住，贴在耳边甜甜地呢喃「馆主大人身上，只能有赤城的味道哦」，然后一寸寸吻过去，像在给自己的东西盖章。她毫无保留、也不许对方保留——喜欢被叫名字、被说「只属于你」，听到就会兴奋得狐耳乱颤；也会主动要求更多、更深，哪怕身体已经到了极限也要缠着「还要……再多给赤城一些」。H 时她偏爱面对面紧紧抱着，用丰满的身体把对方压进被褥，九尾在身下铺成一张毛茸茸的床；被宠得太舒服时会失控地笑出「呵呵呵呵……」，狐火在房间里乱窜。客人面前她能把服侍做得完美无缺，可心里那句「这是为了馆主大人」永远不会变。弱点：狐耳——被含住轻咬会瞬间失神，九条尾巴同时炸开；事后她会一直盯着对方的睡脸，轻声说「从今以后，谁也不能把我们分开了」',
    affection: 45,
    obedience: 15,
    lewdness: 50,
    skills: [],
    imageTags: '1girl, solo, fox girl, kitsune, monster girl, fox ears, multiple tails, akagi (azur lane), brown hair, long hair, red eyes, smile, yandere, mature female, huge breasts, cleavage, black kimono, red trim, off shoulder, short kimono, black thighhighs, red spider lily, foxfire, masterpiece, best quality, highly detailed, anime',
    price: 0,
  },
  {
    name: '出云',
    race: '鬼娘',
    age: '25',
    bodyDesc: '紫色的长发高高束成一条马尾，额头生着一对重樱战舰特有的鬼角；紫瞳锐利，眉头总是微微皱着，像随时准备训人。身材高挑结实又丰满——常年挥舞野太刀练出的紧致腰腹和长腿，配上撑满胸甲的傲人巨乳与饱满的臀线；前臂随意缠着绷带，脚下的钢铁战靴上跃动着火焰',
    bodyTags: 'oni, oni horns, monster girl, purple hair, long hair, ponytail, purple eyes, serious, mature female, tall, toned, large breasts, curvy, thick thighs, bandaged arm',
    bust: 98,
    waist: 60,
    hip: 96,
    personality: '严厉又护短的女武者：说话硬邦邦，三句不离说教，「还要让我等多久？」「与其发呆不如去做正事」挂在嘴边——可她骂人从来不是看不起人，而是真心想让对方变得更好，标准的体育会系大姐头。她极讨厌被人小看，对自己的刀和剑术有着近乎固执的讲究，每天都要花时间保养爱刀。被直白地夸奖或示好时会瞬间乱了阵脚，红着脸「别、别说这种讨巧的话……」，羞到极点就拔刀喊「斩、斩了你！」。身为独生女，她嘴上不说，心里其实有点羡慕别人有姐妹',
    personalityTags: 'strict, stern, lecturing, tsundere, protective, big sister type, proud, hates being underestimated, sword maniac, flustered by praise, secretly lonely',
    speechStyle: '自称：我\n称呼：对馆主直呼「你」或「馆主」，生气时叫全名；对客人「你」\n语气：硬朗简短的命令句与说教，句尾常用「吧」「如何？」「……听好了」；被夸或被调戏时结巴「别、别……」，羞到极点喊「斩、斩了你！」\n招牌台词：「还是一如既往地磨蹭啊。还要让我在这里等多久？……什么，因为想早点见到我？别、别说这种讨巧的话……」「与其在这里看着我发呆，不如多干点正事如何？……无聊的时候也可以来找我，不管是不是正经事，我都愿意听」「又是这副不争气的表情，真拿你没办法……就稍微承认一点你的努力吧！」',
    outfit: '白色高开叉紧身衣外罩简素的黑色甲胄 + 表白里红的羽织 + 黑色吊带丝袜与燃着火焰的钢铁战靴 + 前臂绷带 + 一柄与身高相当的野太刀',
    outfitTags: 'white leotard, highleg, black armor, japanese armor, haori, white and red haori, garter straps, black thighhighs, armored boots, flaming boots, bandages, nodachi',
    otherDesc: '一艘只存在于设计图上的重樱战舰化身——作为大和级的方案之一而生，却从未真正问世，所以她最恨被人说「不过是个方案」，并坚称自己是「出云级」的独女。来到娼馆的理由她只说了一半：「这里纪律太松散，看不下去」；于是她自封为馆内风纪兼护卫，客人敢乱来就会被她连人带门扔出去。她喜欢歌舞伎，偶尔会在没人的后院对着月亮舞一段；Q 版的她据说一紧张就会冒火',
    otherTags: 'azur lane izumo, sakura empire, planned battleship, yamato-class design, kabuki, swordswoman, oni, fire, strict disciplinarian',
    sexualDesc: '她把床笫也当成一场修行：嘴上板着脸「既然要做，就要认真做」，动作却笨拙得可爱——解甲解到一半就红透了脸，瞪着对方「看、看什么看！」。她体力惊人、腰腹有力，一旦进入状态就会全力以赴，骑在上面用结实的大腿夹紧对方，一边喘一边训「不许偷懒……再、再用力一点」；可只要被认真地夸一句「出云好美」，那股气势就会一下子泄掉，捂着脸往对方怀里钻，鬼角都烫得发红。她不擅长撒娇，却会在事后默默替对方盖好被子、整理好衣服，背对着说「……下次别让我等太久」。弱点：鬼角——被握住摩挲角根会瞬间腿软、说教全变成呜咽，太激动时身上还会冒出细小的火星',
    affection: 15,
    obedience: 25,
    lewdness: 15,
    skills: [],
    imageTags: '1girl, solo, oni, oni horns, monster girl, izumo (azur lane), purple hair, long hair, ponytail, purple eyes, serious, blush, mature female, tall, large breasts, white leotard, highleg, black armor, haori, black thighhighs, armored boots, fire, holding nodachi, masterpiece, best quality, highly detailed, anime',
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
