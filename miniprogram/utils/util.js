/* 通用工具函数 */
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dstr(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function today() { return dstr(); }
function dateAdd(s, n) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dstr(d);
}
function parseD(s) { return new Date(s + 'T00:00:00'); }
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
function lastNDays(n, end = today()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateAdd(end, -i));
  return out;
}
function weekRange(d = new Date()) {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [dstr(mon), dstr(sun)];
}
function greet(h) {
  return h < 6 ? '夜深了，早点休息 🌙'
    : h < 9 ? '早上好，新的一天开始啦 ☀️'
    : h < 12 ? '上午好，专注做事最舒服 🍀'
    : h < 14 ? '中午好，记得好好吃饭 🍱'
    : h < 18 ? '下午好，来杯水继续加油 💧'
    : h < 22 ? '晚上好，今天辛苦了 🌸'
    : '夜深了，准备休息吧 🌙';
}

/* 内置 90 组中英双语励志句：按日期确定性轮换，每天自动更新 */
const QUOTES = [
  ['你不需要很厉害才能开始，但你需要开始才会很厉害。', "You don't have to be great to start, but you have to start to be great."],
  ['慢慢来，比较快。', 'Take it slow — slower is often faster.'],
  ['今天的一点点，是明天的一大步。', 'A little today becomes a giant step tomorrow.'],
  ['你比昨天多懂了一点点，这就够了。', 'You know a little more than yesterday. That\'s enough.'],
  ['别急，花开的季节各不同。', "Don't rush — every flower blooms in its own season."],
  ['把注意力放在能做到的事上。', 'Put your energy into what you can actually do.'],
  ['努力的意义，是让选择权留在自己手里。', 'Hard work keeps the right to choose in your own hands.'],
  ['你已经走了这么远，别在这里停下。', "You've come this far — don't stop here."],
  ['允许自己休息，也是一种自律。', 'Resting when you need to is discipline too.'],
  ['先完成，再完美。', 'Done first, perfect later.'],
  ['日子是过以后，不是过从前。', 'Life is lived forward, not backward.'],
  ['认真生活的样子本身就很好看。', 'Living earnestly already looks beautiful.'],
  ['不必和别人比，只和昨天的自己比。', "Don't compare with others — compare with yesterday's you."],
  ['所有的好运，都是努力的另一个名字。', 'Luck is just another name for preparation.'],
  ['今天也要好好吃饭，好好睡觉。', 'Eat well and sleep well today. That matters too.'],
  ['你担心的那件事，大多不会发生。', 'Most of what you worry about never happens.'],
  ['一步一步，也是在往前走。', 'One step at a time is still moving forward.'],
  ['温柔地对待自己，才有力量对待世界。', 'Be gentle with yourself; that\'s where strength comes from.'],
  ['不要因为走得慢，就否定走的每一步。', 'Slow steps are not wasted steps.'],
  ['专注今天，明天会自己到来。', 'Focus on today; tomorrow arrives on its own.'],
  ['想做的事，今天就开始五分钟。', 'Start the thing you want with just five minutes today.'],
  ['你的努力，时间都看得见。', 'Time sees every effort you make.'],
  ['习惯不是靠意志，是靠重复。', 'Habits are built by repetition, not willpower.'],
  ['不必解释，去做就好。', "No explanations needed — just do it."],
  ['情绪会过去，事情会解决。', 'Emotions pass, and problems get solved.'],
  ['把大目标拆成今天能做完的小事。', 'Break big goals into things you can finish today.'],
  ['你值得被自己认真对待。', 'You deserve to be taken seriously — by yourself first.'],
  ['安静地努力，然后惊艳所有人。', 'Work quietly, then let the results speak.'],
  ['今天的心情，由今天的自己决定。', "Today's mood belongs to today's you."],
  ['少想一点，多做一点。', 'Think a little less, do a little more.'],
  ['真正的自由，是能管住自己。', 'Real freedom is being able to govern yourself.'],
  ['别让完美主义拖住了开始。', "Don't let perfectionism delay your start."],
  ['每一次坚持，都在悄悄改变你。', 'Every act of persistence quietly reshapes you.'],
  ['你本来就很可爱，不用证明。', "You're already lovely. No proof required."],
  ['累的时候就停一停，不是放弃。', 'Pausing when tired is not quitting.'],
  ['读过的书，会变成你的底气。', 'The books you read become your quiet confidence.'],
  ['身体的记忆，比意志更可靠。', "The body's memory is more reliable than willpower."],
  ['存下的每一分钱，都是未来的底气。', 'Every yuan saved is future security.'],
  ['你不需要证明给谁看。', 'You have nothing to prove to anyone.'],
  ['小事做好，大事自然来。', 'Do small things well; big things follow.'],
  ['今天比昨天早睡十分钟，也是进步。', 'Ten minutes earlier to bed is progress too.'],
  ['不要用未来的焦虑，毁掉现在的平静。', "Don't let future anxiety ruin present peace."],
  ['选择和努力，同样重要。', 'Choosing wisely matters as much as working hard.'],
  ['你的时间花在哪，你就会成为谁。', 'You become whatever you spend your time on.'],
  ['保持热爱，奔赴山海。', 'Keep your passion and go meet the world.'],
  ['一切正在慢慢变好。', 'Everything is slowly getting better.'],
  ['不用赢过所有人，赢过犹豫就够了。', "You don't need to beat everyone — just your hesitation."],
  ['今天也要给自己一个拥抱。', 'Give yourself a hug today.'],
  ['重复的日子里，藏着复利。', 'Quiet repetition compounds over time.'],
  ['你不必时刻高效，你只需要不放弃。', "You don't need to be efficient every hour — just don't quit."],
  ['把抱怨换成行动，世界就变了。', 'Trade complaints for action and the world shifts.'],
  ['记录，是最好的自我对话。', 'Journaling is the best conversation with yourself.'],
  ['今天做的那件小事，未来会感谢你。', 'Future you will thank you for today\'s small act.'],
  ['心情不好时，先去走一走。', 'When the mood is low, go for a walk first.'],
  ['你正在成为更好的人，虽然很慢。', "You're becoming better — slowly, but truly."],
  ['别人怎么看你，与你无关。', "Other people's opinions are not your business."],
  ['认真吃饭的人，运气不会太差。', 'Those who eat mindfully tend to be lucky.'],
  ['把今天过好，就是最好的计划。', 'Living today well is the best plan there is.'],
  ['不必把所有人请进生命里。', "You don't have to invite everyone into your life."],
  ['你的节奏，就是最好的节奏。', 'Your own pace is the best pace.'],
  ['做难的事，会变强。', 'Doing hard things makes you strong.'],
  ['一次只做一件事。', 'One thing at a time.'],
  ['你今天的坚持，是明天的天赋。', "Today's persistence is tomorrow's talent."],
  ['允许一切发生，也允许自己难过。', 'Let things happen, and let yourself feel sad.'],
  ['先照顾好身体，其他慢慢来。', 'Take care of your body first; the rest can wait.'],
  ['不要为了别人的期待，弄丢自己。', "Don't lose yourself to others' expectations."],
  ['小小的开始，也值得被庆祝。', 'Small beginnings deserve celebration.'],
  ['把目标写在纸上，它就实现了一半。', 'Write the goal down and it\'s half achieved.'],
  ['你的努力不必人人看见。', "Your effort doesn't need an audience."],
  ['专注自己，是最好的修行。', 'Focusing on yourself is the finest practice.'],
  ['今天多喝了一杯水，也是爱自己。', 'One extra glass of water is self-love too.'],
  ['别害怕重来，经验还在。', "Don't fear starting over — experience stays with you."],
  ['不比较，不解释，不回头。', "Don't compare, don't explain, don't look back."],
  ['凡事发生，皆有利于我。', 'Everything that happens works in my favor.'],
  ['你可以慢慢长大，不必着急。', "You can grow slowly. There's no rush."],
  ['有目标的人，连走路都有风。', 'People with purpose walk with the wind.'],
  ['守住自己的节奏，比追赶更重要。', 'Holding your rhythm matters more than catching up.'],
  ['人生的答案，在行动里。', "Life's answers lie in action."],
  ['你的善良要带一点锋芒。', 'Let your kindness carry a little edge.'],
  ['今天也是限量版的一天。', 'Today is a limited edition too.'],
  ['先解决心情，再解决事情。', 'Settle your mood, then settle the matter.'],
  ['看得远一点，走得稳一点。', 'Look farther, walk steadier.'],
  ['你所有的努力，都在被自己记录。', 'All your effort is being recorded — by you.'],
  ['痛苦是成长的必经之路。', 'Discomfort is the road that growth travels.'],
  ['把生活调成自己喜欢的频道。', 'Tune your life to the channel you like.'],
  ['相信积累，别相信奇迹。', 'Trust accumulation, not miracles.'],
  ['做自己的第一个支持者。', 'Be your own first supporter.'],
  ['今天不求完美，只求真实。', 'Today, aim for real, not perfect.'],
  ['走过去，就是风景。', 'Walk through it, and it becomes scenery.'],
  ['把手机放下十分钟，世界会安静。', 'Put the phone down for ten minutes; the world quiets down.'],
  ['你的未来，藏在今天的习惯里。', 'Your future hides in today\'s habits.'],
  ['慢慢积累，总会有答案。', 'Keep accumulating; answers will come.']
];
function quoteOfDay(ds = today()) {
  const seed = parseD(ds).getTime() / 86400000;
  const i = Math.abs(Math.floor(seed)) % QUOTES.length;
  return QUOTES[i];
}

module.exports = {
  pad, uid, clamp, dstr, today, dateAdd, parseD, WEEK_CN, daysBetween, lastNDays, weekRange, greet,
  QUOTES, quoteOfDay
};
