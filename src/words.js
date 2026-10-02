(function (root) {
  'use strict';

  // Common English, ordered by rough frequency - most common first.
  //
  // The order is load-bearing, not cosmetic: the generator samples the front of
  // this list far more often than the back (see RANK_EXP in generator.js), so a
  // word's position here is how common it will feel in play.
  //
  // The bar for inclusion is "a fast typist would never have to think about it".
  // An earlier pool was grown to 3142 words for variety and served up wield,
  // keel, phantom, torment, situate and worship - vocabulary, not typing. This
  // game is about rhythm, and you cannot hold a rhythm through a word you are
  // still reading. Variety now comes from the sampler and the chapter filters,
  // not from reaching further down the frequency list.
  //
  // Excluded on purpose: anything with a UK/US spelling split (colour, centre,
  // neighbour), anything capitalised in real use, and anything outside 2-9
  // letters. A typing game must never make the player guess which spelling is
  // on screen.
  const WORDS = [
    'the','be','to','of','and','in','that','have','it','for','not','on','with','he','as',
    'you','do','at','this','but','his','by','from','they','we','say','her','she','or','an',
    'will','my','one','all','would','there','their','what','so','up','out','if','about','who',
    'get','which','go','me','when','make','can','like','time','no','just','him','know','take',
    'into','year','your','good','some','could','them','see','other','than','then','now',
    'look','only','come','its','over','think','also','back','after','use','two','how','our',
    'work','first','well','way','even','new','want','any','these','give','day','most','us',
    'is','was','are','been','has','had','were','said','did','got','am','being','man','men',
    'old','long','little','own','under','last','right','big','high','small','large','next',
    'early','young','few','bad','same','able','best','better','sure','free','true','full',
    'hard','open','real','white','black','red','green','blue','half','home','house','school',
    'room','door','car','road','city','town','week','month','name','word','world','life',
    'hand','part','place','case','point','group','number','water','air','fire','land','sea',
    'tree','book','page','line','side','end','top','face','head','eye','foot','feet','body',
    'mind','heart','mother','father','child','children','friend','family','people','person',
    'woman','women','boy','girl','baby','king','money','job','team','game','play','music',
    'light','dark','sound','voice','story','news','idea','fact','kind','sort','type','form',
    'thing','things','another','around','because','before','between','both','came','does',
    'down','each','ever','every','far','find','found','great','help','here','himself','keep',
    'kept','left','let','live','made','many','may','might','more','move','much','must','near',
    'need','never','night','nothing','off','often','once','order','put','read','run','saw',
    'second','seem','seen','set','show','since','sometimes','soon','still','such','tell',
    'thought','three','through','told','took','turn','until','upon','used','very','went',
    'where','while','whole','why','wish','without','write','across','act','add','age','ago',
    'agree','allow','almost','alone','along','already','although','always','among','amount',
    'animal','answer','anyone','anything','appear','apply','area','arm','army','art','ask',
    'asked','attack','author','away','bank','base','bear','beat','beautiful','became',
    'become','bed','begin','behind','believe','below','beside','beyond','bird','bit','blood',
    'blow','board','boat','bone','born','bottom','box','bread','break','bring','broke',
    'brother','brought','brown','build','built','burn','busy','buy','call','called','calm',
    'camp','cannot','care','carry','catch','caught','cause','certain','chair','chance',
    'change','check','choose','church','circle','claim','class','clean','clear','close',
    'cloth','cloud','coal','coat','cold','common','company','compare','complete','consider',
    'contain','control','cook','cool','copy','corner','cost','count','country','couple',
    'course','cover','create','cross','crowd','cry','current','cut','dance','danger','date',
    'daughter','dead','deal','dear','death','decide','deep','degree','depend','desk','detail',
    'develop','die','different','difficult','dinner','direct','discover','distance','divide',
    'doctor','dog','dollar','doubt','draw','dream','dress','drink','drive','drop','dry',
    'during','duty','ear','earth','ease','east','easy','eat','edge','effect','effort','egg',
    'eight','either','else','empty','enemy','enjoy','enough','enter','equal','escape',
    'evening','event','example','except','exist','expect','explain','extra','fail','fair',
    'fall','famous','farm','fast','fear','feed','feel','fell','felt','field','fight','figure',
    'fill','final','fine','finger','finish','firm','fish','fit','five','fix','flat','floor',
    'flower','fly','follow','food','force','forest','forget','forward','four','fresh','front',
    'fruit','fun','garden','gather','gave','general','gentle','gift','glad','glass','gold',
    'gone','grass','ground','grow','guard','guess','guide','hair','hall','handle','hang',
    'happen','happy','hat','hate','health','hear','heat','heavy','held','hide','hill',
    'history','hit','hold','hole','holiday','honest','hope','horse','hospital','hot','hotel',
    'hour','however','human','hundred','hunt','hurry','hurt','ill','imagine','important',
    'improve','include','increase','indeed','inside','instead','interest','iron','island',
    'issue','join','joy','judge','jump','key','kill','kitchen','knew','knife','known','lady',
    'lake','language','late','laugh','law','lay','lead','leaf','learn','least','leave','led',
    'leg','lend','length','less','lesson','letter','level','lie','lift','limit','lip','list',
    'listen','local','lock','lose','loss','lost','lot','loud','love','low','luck','lunch',
    'machine','main','major','manage','manner','map','mark','market','marry','match','matter',
    'mean','meant','measure','meat','meet','member','memory','mention','middle','mile','milk',
    'mine','minute','miss','mistake','modern','moment','moon','morning','mountain','mouth',
    'movie','narrow','nation','nearly','necessary','neck','neither','nice','nine','none',
    'nor','north','nose','note','notice','obey','object','ocean','offer','office','oil',
    'opinion','outside','pain','paint','pair','paper','parent','park','party','pass','past',
    'path','pay','peace','pen','perhaps','period','phone','pick','picture','piece','plain',
    'plan','plane','plant','please','poor','popular','position','possible','post','pound',
    'power','prepare','present','press','pretty','price','print','private','prize','problem',
    'produce','promise','proper','protect','proud','prove','public','pull','purpose','push',
    'question','quick','quiet','quite','race','radio','rain','raise','rather','reach','ready',
    'reason','receive','record','remain','remember','remove','repeat','reply','report','rest',
    'result','return','rich','ride','ring','rise','river','rock','roll','roof','root','rope',
    'round','rule','safe','sail','salt','sand','save','scene','science','search','season',
    'seat','secret','sell','send','sense','sent','separate','serious','serve','service',
    'settle','seven','several','shake','shall','shape','share','sharp','sheep','shelf',
    'shine','ship','shoe','shoot','shop','short','should','shoulder','shout','shut','sick',
    'sign','silence','silver','simple','sing','single','sister','sit','six','size','skin',
    'sky','sleep','slow','smell','smile','smoke','snow','soft','soil','soldier','son','song',
    'sorry','south','space','speak','special','speed','spend','spent','spoke','sport','spot',
    'spread','spring','square','stage','stair','stand','star','start','state','station',
    'stay','steal','steel','step','stick','stone','stop','store','storm','straight','strange',
    'street','strong','study','subject','success','sudden','suffer','sugar','suit','summer',
    'sun','supply','suppose','surprise','sweet','swim','table','talk','tall','taste','teach',
    'teacher','ten','term','test','thank','thick','thin','third','those','though','thousand',
    'throw','thus','tie','tight','till','tired','today','together','tomorrow','tonight','too',
    'total','touch','toward','trade','train','travel','trip','trouble','trust','try','twelve',
    'twenty','twice','uncle','unit','useful','usual','valley','value','various','view',
    'village','visit','wait','wake','walk','wall','war','warm','wash','watch','wave','weak',
    'wear','weather','weight','welcome','west','wet','wheel','whether','wide','wife','wild',
    'win','wind','window','wine','wing','winter','wise','within','wonder','wood','worry',
    'worth','wrong','yes','yesterday','yet',
  ];

  // 'common tongue' is simply the head of the list, so it can never drift out
  // of step with the pool the way a separately maintained set did.
  const TOP200 = new Set(WORDS.slice(0, 150));

  const api = { WORDS, TOP200 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
