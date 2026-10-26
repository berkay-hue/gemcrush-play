// Oyuncu durumu: yerel kayıt (localStorage eşleniği) + isteğe bağlı Supabase aynası.
// Web'deki src/meta/save.js'in birebir taşınması. Kayıt nesnesi JS'teki gibi
// serbest biçimli bir harita: alanları ~40 meta modülü doğrudan yazıyor ve
// buluta JSON olarak gidiyor, bu yüzden tipli sınıfa sıkıştırılmıyor.
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

import '../analytics.dart';
import '../config.dart';
import '../engine/gameclock.dart';
import '../i18n.dart' show getLang, setLang; // F332
import 'js.dart';
import 'store.dart';

const String _key = 'gemcrush.save.v1';

String _uuid() {
  final r = math.Random.secure();
  String h(int n) => List.generate(n, (_) => r.nextInt(16).toRadixString(16)).join();
  return '${h(8)}-${h(4)}-4${h(3)}-${(8 + r.nextInt(4)).toRadixString(16)}${h(3)}-${h(12)}';
}

int _now() => gameNow().millisecondsSinceEpoch;

Map<String, dynamic> _def() => {
      'deviceId': _uuid(),
      'level': 1, // açılan en yüksek bölüm
      'stars': <String, dynamic>{}, // levelId -> 0..3
      'best': <String, dynamic>{}, // levelId -> skor
      'coins': Config.coins.start,
      'lives': Config.lives.max,
      'lifeTs': _now(), // son can dolum tiki
      'inLevel': 0, // oynanan bölüm (kapanırsa açılışta can düşülür)
      'boosters': {'hammer': 1, 'moves5': 1, 'shuffle': 1, 'prism': 0},
      'daily': {'last': 0, 'streak': 0},
      'removeAds': false,
      'sound': true,
      'music': true, // F40: arka plan müziği
      'haptics': true, // titreşim
      'lang': null,
      'levelsPlayed': 0,
      'tutorialDone': false,
      'v': 2, // kayıt şeması sürümü
      'starsSpent': 0,
      'profile': {'name': '', 'avatar': '🧑‍🌾'},
      'gems': 5, // Faz 5: sert para (elmas)
      'theme': 'meadow', 'themes': <dynamic>[], // F4: satın alınan temalar
      'farm': {'owned': <dynamic>[], 'perks': <String, dynamic>{}}, // çiftlik alımları + türetilmiş perkler
      'event': {'week': -1, 'done': 0}, // F14: hasat festivali ilerlemesi
      'pass': {'season': '', 'xp': 0, 'claimed': <dynamic>[]}, // F14: sezon yolu
    };

final Map<String, dynamic> save = _load();

Map<String, dynamic> _load() {
  try {
    final raw = Store.getItem(_key);
    if (raw != null) {
      return _migrate({..._def(), ...(jsonDecode(raw) as Map).cast<String, dynamic>()});
    }
  } catch (_) {}
  return _def();
}

// v1 -> v2: çiftlik cüzdanı. v2 öncesi kazanılan yıldızlar anında harcanabilir olur.
Map<String, dynamic> _migrate(Map<String, dynamic> s) {
  final d = _def();
  s['farm'] = {...(d['farm'] as Map), ...((s['farm'] as Map?) ?? {})};
  final farm = s['farm'] as Map;
  farm['owned'] = farm['owned'] is List ? farm['owned'] : <dynamic>[];
  s['profile'] = {...(d['profile'] as Map), ...((s['profile'] as Map?) ?? {})};
  if (s['gems'] is! num || (s['gems'] as num) < 0) s['gems'] = d['gems'];
  if (s['starsSpent'] is! num || (s['starsSpent'] as num) < 0) s['starsSpent'] = 0;
  s['themes'] = s['themes'] is List ? (s['themes'] as List).whereType<String>().take(20).toList() : <dynamic>[];
  if (s['theme'] is! String || (s['theme'] != 'meadow' && !(s['themes'] as List).contains(s['theme']))) s['theme'] = 'meadow';
  final e = (s['event'] as Map?) ?? {};
  s['event'] = {
    'week': e['week'] is int ? e['week'] : -1,
    'done': e['done'] is int && e['done'] >= 0 && e['done'] <= 10 ? e['done'] : 0,
  };
  final p = (s['pass'] as Map?) ?? {};
  s['pass'] = {
    'season': p['season'] is String ? p['season'] : '',
    'xp': p['xp'] is num && (p['xp'] as num) >= 0 ? math.min((p['xp'] as num).toInt(), 750) : 0,
    'claimed': p['claimed'] is List ? (p['claimed'] as List).where((x) => x is int && x >= 1 && x <= 30).toList() : <dynamic>[],
  };
  s['v'] = 2;
  return s;
}

// ---- Kayıt alanı: profil + kayıt kodu (cihaz taşıma) + veri silme ----
// F308: sunucu da bu listeyi tutar (gc_ab_avatar, supabase/f308-avatar.sql); yeni avatar eklerken orayı da güncelle.
const List<String> avatars = ['🧑‍🌾', '👩‍🌾', '👨‍🌾', '🐔', '🐄', '🐑', '🦊', '🐱'];

void setProfile(Map<String, dynamic> p) {
  save['profile'] = {...((save['profile'] as Map?) ?? {}), ...p};
  persist();
}

String exportCode() => 'GC1.${base64Encode(utf8.encode(jsonEncode(save)))}';

Map<String, dynamic>? _decodeCode(String code) {
  try {
    final body = code.trim().replaceFirst(RegExp(r'^GC1\.'), '');
    final obj = jsonDecode(utf8.decode(base64Decode(body)));
    if (obj is! Map || obj['level'] is! num) return null;
    return obj.cast<String, dynamic>();
  } catch (_) {
    return null;
  }
}

// F146: kodu yüklemeden önce onay için bölüm ve altın (kayda dokunmaz)
({int level, int coins})? peekCode(String code) {
  final o = _decodeCode(code);
  if (o == null) return null;
  return (level: (o['level'] as num).toInt(), coins: o['coins'] is num ? (o['coins'] as num).toInt() : 0);
}

bool importCode(String code) {
  try {
    final obj = _decodeCode(code);
    if (obj == null) return false;
    // F126: koddaki sürüm taşınmaz — ileri sürümlü bir kod sonraki eşitliklerde bulutu hep ezmesin
    final next = _migrate({..._def(), ...obj})..remove('rev');
    save..clear()..addAll(next);
    _keepLang(); // F332
    persist();
    _regrant(); // F309: buluta ulaşmamış (misafir, itilmemiş) alımlar yüklenen kayda da işlenir
    return true;
  } catch (_) {
    return false;
  }
}

// F127: sunucu silmesi başarısızsa (ağ/sunucu hatası) yerelde hiçbir şeye dokunma → false (token kalır, tekrar denenir)
Future<bool> wipeAll() async {
  final a = account();
  if (a != null) {
    final dynamic ok;
    try { ok = await _rpc('gc_delete', {'p_token': a['token']}); } catch (_) { return false; }
    // F339: false = token sunucuda yok (hesaba başka cihazdan girildi) → hesap bulutta duruyor; silindi deme.
    // Oturum düşer (üstte uyarı), yerel kayıt durur; yeniden girip tekrar silinir.
    if (ok != true) { _dropSession(a); return false; }
    _setAccount(null);
  }
  Store.removeItem(_key);
  Store.removeItem(_skey); // F126
  Store.removeItem(_lkey); // F215
  Store.removeItem(_bkey); // F217
  Store.removeItem(_sskey); // F218
  save..clear()..addAll(_def());
  persist();
  return true;
}

Timer? _syncTimer;

// F126: kayıt sürümü — her persist'te artar (cihazda tekdüze, cihazlar arası pratikte tekil).
// İlerleme eşitken hangi tarafın değiştiğini ayırmak için. Eski kayıtta yok → 0.
int _rev(Map s) => (s['rev'] as num?)?.toInt() ?? 0;

void persist() {
  save['rev'] = math.max(_rev(save) + 1, _now()); // F126
  try { Store.setItem(_key, jsonEncode(save)); } catch (_) {}
  if (account() != null) {
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(milliseconds: 2500), _pushCloud);
  }
}

// ---- Hesap: kullanıcı adı + şifre, ilerleme bulutta (gc_* RPC, token hash'li) ----
const String _akey = 'gemcrush.account.v1';

Map<String, dynamic>? account() {
  try {
    final raw = Store.getItem(_akey);
    if (raw == null) return null;
    final j = jsonDecode(raw);
    return j is Map ? j.cast<String, dynamic>() : null;
  } catch (_) {
    return null;
  }
}

// F209: hesap değişince (kayıt, giriş, çıkış, oturum düşmesi, hesap silme) çağrılır: bildirim kaydı yeni hesaba
// hemen bağlansın, çıkışta hesaptan ayrılsın. Mikro görevle çalışır: girişte bulut kaydı (dili) benimsendikten sonra.
void Function()? onAccountChanged;

void _setAccount(Map<String, dynamic>? a) {
  if (a != null) { Store.setItem(_akey, jsonEncode(a)); Store.removeItem(_lkey); } else { Store.removeItem(_akey); } // F215
  final f = onAccountChanged;
  if (f != null) scheduleMicrotask(f);
}

// F215: sunucu oturumu düşürünce (hesaba başka cihazdan girildi ya da hesap başka cihazdan silindi) hesap sessizce
// çıkıyordu; bulut yedeğinin durduğu fark edilmiyordu. Düşen ad burada kalır: giriş formu ve ayarlar nedeni yazar,
// ad hazır gelir; yeniden giriş/kayıtta ve tüm silmede silinir. Çıkış yazmaz.
const String _lkey = 'gemcrush.lost.v1';

String? lostUser() => Store.getItem(_lkey);

// düşme anında bir kez (mikro görevle, onAccountChanged'den sonra): main.dart üstte uyarı şeridi gösterir
void Function()? onSessionLost;

void _dropSession(Map<String, dynamic> a) {
  if (account()?['token'] != a['token']) return; // bu arada çıkıldıysa ya da başka hesaba girildiyse dokunma
  final u = '${a['user'] ?? ''}';
  if (u.isNotEmpty) Store.setItem(_lkey, u);
  _setAccount(null);
  final f = onSessionLost;
  if (u.isNotEmpty && f != null) scheduleMicrotask(f);
}

// F126: cihazdaki kaydın sahibi + o hesabın bulutuyla son eşleşen sürüm (kaydın dışında, cihaza özel).
// Çıkışta silinmez: yerel kayıt hâlâ o hesabın sayılır, başka hesaba itilmez.
const String _skey = 'gemcrush.sync.v1';

Map<String, dynamic> _sync() {
  try {
    final j = jsonDecode(Store.getItem(_skey) ?? '');
    return j is Map ? j.cast<String, dynamic>() : {};
  } catch (_) {
    return {};
  }
}

void _setSync(Object? user, int? rev, [int? score]) {
  if (user is String) { Store.setItem(_skey, jsonEncode({'user': user, 'rev': rev})); } else { Store.removeItem(_skey); }
  if (user is String && rev != null && score != null) {
    Store.setItem(_sskey, jsonEncode({'user': user, 'rev': rev, 'score': score}));
  } else {
    Store.removeItem(_sskey);
  }
}

// F218: son eşleşmedeki ilerleme puanı (bölüm+yıldız). Ayrı anahtarda: eşleşme bilgisinin biçimi değişmez;
// sahibi ya da sürümü eşleşme bilgisiyle uyuşmuyorsa (puansız yazılmış eşleşme) yok sayılır → null.
const String _sskey = 'gemcrush.syncscore.v1';

int? _syncedScore(Object? user) {
  final m = _sync();
  try {
    final j = jsonDecode(Store.getItem(_sskey) ?? '');
    if (user == null || j is! Map || m['user'] != user || j['user'] != user || m['rev'] == null || j['rev'] != m['rev']) return null;
    return (j['score'] as num?)?.toInt();
  } catch (_) {
    return null;
  }
}

// bu hesap için bilinen son eşleşme; sahip farklıysa ya da bilinmiyorsa null (eski davranış)
int? _synced(Object? user) {
  final m = _sync();
  return user != null && m['user'] == user ? (m['rev'] as num?)?.toInt() : null;
}

// F127: zaman aşımı yalnızca salt okunan / tekrarı zararsız çağrılarda. Sunucuda değer taşıyan çağrılar (ilan, alım, hediye,
// ödül/sandık/promosyon alma, yıldız→altın, kayıt…) beklemeye devam eder: sunucu işler ama geç gelen cevap atılırsa
// ödül kaybolur (claimed=true) ya da mal çiftlenir. Yeni RPC buraya eklenmedikçe zaman aşımı almaz.
const Set<String> _timeoutOk = {
  'gc_pull', 'gc_push', 'gc_me', 'gc_delete', 'gc_leaderboard', 'gc_inbox', 'gc_market_list',
  'gc_friend_list', 'gc_friend_farm', 'gc_friend_lb', 'gc_public_farm',
  'gc_friend_reqs', 'gc_friend_reject', // F311: istek listesi salt okunur; ret tekrarı zararsız
  'gc_clan_me', 'gc_clan_list', 'gc_clan_msgs', 'gc_clan_league', 'gc_race_board', 'gc_rank_board',
  'gc_pgift_left', 'gc_cgift_sent', 'gc_star_coin_info', 'gc_app_version', 'gc_log_error', 'gc_log_revenue',
  'gc_pgift_send', 'gc_cgift_send', // F300: hediye kimlikli; geç cevapta aynı kimlikle yeniden denenir, çiftlenmez
};

// F279: 4xx + sunucu mesajı → istek reddedildi, işlem geri alındı. 5xx'te (ağ geçidi mesajı olsa da) sunucu yazmış olabilir.
class _Refused implements Exception {
  final String message;
  final int status;
  const _Refused(this.message, [this.status = 400]);
  @override
  String toString() => 'Exception: $message';
}

Future<dynamic> _rpc(String fn, Map<String, dynamic> body) async {
  const c = Config.cloud;
  if (c.url.isEmpty) throw Exception('offline');
  // F127: takılan bağlantıda sonsuza dek bekleme (açılış senkronu, sosyal paneller) → TimeoutException, çağıranlar zaten yakalıyor
  final req = http.post(
    Uri.parse('${c.url}/rest/v1/rpc/$fn'),
    headers: {'apikey': c.key, 'Content-Type': 'application/json'},
    body: jsonEncode(body),
  );
  final r = await (_timeoutOk.contains(fn) ? req.timeout(const Duration(seconds: 10)) : req);
  // F298: sunucunun Date başlığı cihaz saatini düzeltir (2 dk üstü sapma); çevrimdışı açılışta da geçsin diye saklanır
  final o = observeServerDate(r.headers['date']);
  if (o != null) { if (o == 0) { Store.removeItem('gc_clk'); } else { Store.setItem('gc_clk', '$o'); } }
  dynamic j;
  try { j = jsonDecode(r.body); } catch (_) { j = null; }
  if (r.statusCode < 200 || r.statusCode >= 300) {
    final m = (j is Map && j['message'] is String) ? j['message'] as String : null;
    if (m != null && r.statusCode < 500) throw _Refused(m, r.statusCode);
    throw Exception(m ?? 'ag');
  }
  return j;
}

// ilerleme puanı: hangisi daha ileride
int progressScore(Map s) {
  final stars = (s['stars'] as Map?) ?? {};
  final sum = stars.values.fold<int>(0, (a, n) => a + (n is num ? n.toInt() : 0));
  return ((s['level'] as num?)?.toInt() ?? 0) * 1000 + sum;
}

// F126: bulut mu, yerel mi? İlerleme (bölüm+yıldız) farklıysa bugünkü kural aynen: ileride olan.
// Eşitse girişte her zaman bulut (bugünkü kural): eski sürüm uygulama (1.1.9), web ve sunucu yazıcıları
// rev artırmaz, yerel değişiklik onların yazdığını (ör. başka cihazda alınan elmas) ezmesin.
// Açılışta sürüme bakılır: son eşleşmeden (synced) beri yalnız değişen taraf, ikisi de değiştiyse yeni olan;
// synced yoksa yerel. localRev: açılış anındaki yerel sürüm (bekleme sırasında persist olabilir).
bool cloudWins(Object? cloud, Map local, {int? synced, int? localRev, bool login = false}) {
  if (cloud is! Map || cloud['level'] is! num) return false;
  final pc = progressScore(cloud), pl = progressScore(local);
  if (pc != pl) return pc > pl;
  if (login) return true;
  if (synced == null) return false;
  final cr = _rev(cloud), lr = localRev ?? _rev(local);
  final cc = cr > synced, lc = lr > synced;
  if (cc != lc) return cc;
  return cc && cr > lr; // ikisi de değiştiyse yeni olan; hiçbiri değişmediyse yerel
}

// F126: kayıt buluttan değiştikçe artar; açık sahne eskiyi göstermesin diye bakar
int saveEpoch = 0;

// F332: benimsenen kayıt dili değiştirebilir (girişte gc_login, açılışta gc_pull, kodla yükleme). Oyun cihazda
// seçili dilde kalıyor, bildirim kaydı ve sonraki açılış kaydın dilini kullanıyordu; kayıtta dil yoksa (boş bulut,
// dilsiz kod) dil seçici sonraki açılışta yeniden çıkıyordu. Çalışan dil kayda uyar; kayıtta dil yoksa seçili dil yazılır.
// Kayıttan önce çalışır: girişteki bildirim kaydı (onAccountChanged, mikro görev) aynı dili gönderir.
void _keepLang() {
  final l = save['lang'];
  if (l is String) setLang(l);
  save['lang'] = getLang();
}

void _adopt(Map obj) {
  final next = _migrate({..._def(), ...obj.cast<String, dynamic>()});
  save..clear()..addAll(next);
  _keepLang();
  try { Store.setItem(_key, jsonEncode(save)); } catch (_) {}
  saveEpoch++;
}

// F217: buluta ulaşmamış mağaza ödülleri defteri (F183'ün yalnız bekleme anını kapsayan listesinin yerine).
// Ödeme alınmış, mağazada onaylanmış ödül; bulut kaydı benimsenirse (girişte gc_login, açılışta gc_pull)
// silinmesin: misafirken, bulut beklenirken, oturum düşmüşken ya da itiş başarısızken yapılan alım deftere
// yazılır, benimsenen kayda yeniden işlenir (işlem kimliğiyle tekil). Kayıt, o ödülü içeren sürüm buluta
// itilince defterden silinir.
const String _bkey = 'gemcrush.iappending.v1';

/// Defterdeki alımı benimsenen kayda yeniden işler (iap.dart bağlar; save.dart onu içe aktaramaz).
void Function(Map<String, dynamic> r)? onRegrantPurchase;

List<Map<String, dynamic>> _buys() {
  try {
    final l = jsonDecode(Store.getItem(_bkey) ?? '[]');
    return [if (l is List) for (final e in l) if (e is Map) e.cast<String, dynamic>()];
  } catch (_) {
    return [];
  }
}

void _setBuys(List<Map<String, dynamic>> l) {
  if (l.isEmpty) { Store.removeItem(_bkey); return; }
  try { Store.setItem(_bkey, jsonEncode(l.length > 20 ? l.sublist(l.length - 20) : l)); } catch (_) {}
}

/// Verilen mağaza ödülünü (ödül persist edildikten sonra) deftere yazar; [r] onRegrantPurchase'a geri verilir.
void noteBuy(Map<String, dynamic> r) => _setBuys([..._buys(), {...r, 'rev': _rev(save)}]);

// upTo sürümüne kadar yazılanlar o sürümle buluta gitti
void _clearBuys(int upTo) {
  final l = _buys();
  if (l.isEmpty) return;
  _setBuys([for (final r in l) if (r['rev'] is num && (r['rev'] as num).toInt() > upTo) r]);
}

// Bulut kaydı beklenen hesaplar: bekleme sırasında aynı hesaba itilen kayıt, benimsenecek (itişten önce okunmuş)
// bulut kaydıyla ezilebilir → o itiş defteri silmez
final Map<Object?, int> _waits = {};

Future<dynamic> _cloudSave(Object? user, String fn, Map<String, dynamic> body) async {
  _waits[user] = (_waits[user] ?? 0) + 1;
  try {
    return await _rpc(fn, body);
  } finally {
    final n = (_waits[user] ?? 1) - 1;
    if (n > 0) { _waits[user] = n; } else { _waits.remove(user); }
  }
}

// benimsemeden sonra: defterdeki alımlar yeni kayda (yeniden işlenen ödül defterde yeni sürümle kalır)
void _regrant() {
  final h = onRegrantPurchase;
  if (h == null) return;
  final l = _buys();
  if (l.isEmpty) return;
  _setBuys([]);
  for (final r in l) {
    try { h(r); } catch (_) { _setBuys([..._buys(), r]); }
  }
}

// F309: girişte yerel kayıt kazanınca buluta itmeden önce, buluttaki kayıtta olup yerelde olmayan alımlar
// (başka cihazda alınıp itilmiş, deftere artık yazılmayan) yerel kayda işlenir; yoksa itiş onları siler.
// Yerel iapGranted kırpıldıysa (100) hangisinin verildiği bilinemez → atlanır. 'm': deftere yazılmaz
// (alım bulut kaydında zaten var; itiş düşer de başka hesaba geçilirse oraya işlenmesin).
void _mergeCloudBuys(Object? cloud) {
  final h = onRegrantPurchase, log = cloud is Map ? cloud['iapLog'] : null, cur = save['iapGranted'];
  if (h == null || log is! List) return;
  final mine = {if (cur is List) for (final e in cur) '$e'};
  if (mine.length >= 100) return;
  for (final e in log.whereType<Map>()) {
    final id = e['id'], p = e['p'], g = e['g'];
    if (id is! String || id.isEmpty || p is! String || mine.contains(id)) continue;
    try { h({'p': p, 'id': id, 'g': ?(g is num ? g.toInt() : null), 'm': true}); } catch (_) {}
  }
}

// acc: çıkışta hesap silindikten sonra son itiş için. true = sunucu kaydı aldı (F260)
Future<bool> _pushCloud([Map<String, dynamic>? acc]) async {
  final a = acc ?? account();
  if (a == null) return false;
  final r = _rev(save), sc = progressScore(save); // F126: gönderilen sürüm (F218: ve ilerleme)
  try {
    await _rpc('gc_push', {'p_token': a['token'], 'p_save': save});
    if (_sync()['user'] == a['user']) _setSync(a['user'], r, sc);
    if (!_waits.containsKey(a['user'])) _clearBuys(r); // F217
    return true;
  } catch (e) {
    if (RegExp('oturum').hasMatch('$e')) _dropSession(a);
    return false;
  }
}

Future<void> register(String user, String pass) async {
  final r = _rev(save), sc = progressScore(save);
  final token = await _rpc('gc_register', {'p_user': user, 'p_pass': pass, 'p_save': save});
  final u = user.trim().toLowerCase();
  _setAccount({'user': u, 'token': token});
  _setSync(u, r, sc); // F126: yerel kayıt artık bu hesabın, bulutla eşit
  _clearBuys(r); // F217: alımlar gönderilen kayıtla buluta gitti
}

// giriş: buluttaki ve cihazdaki kayıttan ileride olanı tutar, eşitse bulut (F126: başka hesabın değişmemiş kaydı itilmez)
Future<void> login(String user, String pass) async {
  final lr = _rev(save), ls = progressScore(save); // F183: karar bekleme öncesine göre (beklerken gelen ödül/can dolumu yerel değişiklik sayılmaz)
  final u = user.trim().toLowerCase();
  final r = await _cloudSave(u, 'gc_login', {'p_user': user, 'p_pass': pass});
  _setAccount({'user': u, 'token': r['token']});
  final s = r['save'];
  final owner = _sync()['user'];
  // F126: cihazdaki kayıt başka hesabınsa ve o hesapla son eşleşmeden beri değişmediyse buluta itme —
  // bu hesabın kaydını al (yoksa sıfırdan). Eşleşmemiş yerel değişiklik varsa (çıkıştan sonra misafir oyun,
  // satın alma, çevrimdışı) bugünkü kural: ileride olan kalır, eşitse bulut (synced null → cloudWins).
  // F218: "değişti" ilerlemeye (bölüm+yıldız) bakar, sürüme değil. Çıkıştan sonra can dolumu, saat düzeltmesi,
  // kaybedilen bölüm, ayar ya da altın sürümü artırır ama önceki hesabın kaydını yeni hesaba itmeye yetmez
  // (önceki hesap ilerideyse yeni hesabın bulutu eziliyordu). Misafir alımı F217 defterinden yeni kayda işlenir.
  // Puan bilinmiyorsa (puansız eşleşme) sürüm kuralı.
  if (owner != null && owner != u) {
    final sr = (_sync()['rev'] as num?)?.toInt(), ss = _syncedScore(owner);
    if (ss != null ? ls == ss : sr != null && lr <= sr) {
      _adopt(s is Map && s['level'] is num ? s : const {});
      _setSync(u, _rev(save), progressScore(save));
      _regrant();
      return;
    }
  }
  if (cloudWins(s, save, synced: _synced(u), login: true)) {
    _adopt(s as Map);
    _setSync(u, _rev(save), progressScore(save));
    _regrant();
  } else {
    _setSync(u, _synced(u), _syncedScore(u));
    _mergeCloudBuys(s);
    await _pushCloud();
  }
}

// F5: sıralama — önce güncel ilerlemeyi it ki kendi sıran taze olsun
Future<dynamic> leaderboard(String kind) async {
  final a = account();
  if (a != null) { _syncTimer?.cancel(); await _pushCloud(); }
  return _rpc('gc_leaderboard', {'p_kind': kind, 'p_token': a?['token'], 'p_limit': 50});
}

// F9: arkadaşlar — kod (ya da kullanıcı adı) ile ekle, çiftliğini salt-okunur ziyaret et
String _tok() {
  final a = account();
  if (a == null) throw Exception('hesap');
  return a['token'] as String;
}

Future<dynamic> myFriendCode() => _rpc('gc_me', {'p_token': _tok()});

// F97: isim moderasyonu + ban. Sunucu kayıtta uygunsuz/kilitli görünen ismi sessizce
// geri yazar; açık hata kodu (isim_uygunsuz / isim_kilitli) gc_set_name'den gelir.
// Kullanıcı adı ise kayıtta reddedilir (isim_uygunsuz → authError 'isim', F194).
/// null = kabul edildi (ya da hesap yok/çevrimdışı, yerel isim kalır);
/// aksi halde i18n anahtarı: 'isimUygunsuz' | 'isimKilitli'.
Future<String?> setNameCloud(String name) async {
  if (account() == null) return null;
  try {
    final r = await _rpc('gc_set_name', {'p_token': _tok(), 'p_name': name});
    if (r is Map && r['name'] is String) setProfile({'name': r['name']});
    return null;
  } catch (e) {
    final s = '$e';
    if (s.contains('isim_kilitli')) return 'isimKilitli';
    if (s.contains('isim_uygunsuz')) return 'isimUygunsuz';
    return null;
  }
}

Future<bool> reportPlayer(String uid, [String reason = 'isim']) async {
  try { await _rpc('gc_report_player', {'p_token': _tok(), 'p_target': uid, 'p_reason': reason}); return true; }
  catch (_) { return false; }
}

/// Banlıysa {'until': 'kalici' | ISO tarih, 'reason': ...}; değilse null.
/// Yan etki: sunucunun zorladığı ismi yerel profile de yazar.
Future<Map<String, dynamic>?> myModeration() async {
  if (account() == null) return null;
  try {
    final r = await _rpc('gc_me', {'p_token': _tok()});
    if (r is! Map) return null;
    final n = r['name'];
    if (n is String && n.isNotEmpty && n != (save['profile'] as Map?)?['name']) setProfile({'name': n});
    if (r['banned'] == true) return {'until': '${r['banned_until'] ?? ''}', 'reason': '${r['ban_reason'] ?? ''}'};
  } catch (_) {}
  return null;
}
Future<dynamic> friendList() => _rpc('gc_friend_list', {'p_token': _tok()});
// F311: ekleme önce istek bırakır ({pending:true}); karşı taraf beni eklediyse kabul olur ({accepted:true})
Future<dynamic> friendAdd(String code) => _rpc('gc_friend_add', {'p_token': _tok(), 'p_code': code});
Future<dynamic> friendReqs() => _rpc('gc_friend_reqs', {'p_token': _tok()});
Future<dynamic> friendReject(String code) => _rpc('gc_friend_reject', {'p_token': _tok(), 'p_code': code});
Future<dynamic> friendRemove(String code) => _rpc('gc_friend_remove', {'p_token': _tok(), 'p_code': code});
Future<dynamic> friendFarm(String code) => _rpc('gc_friend_farm', {'p_token': _tok(), 'p_code': code});

// F11: arkadaş etkileşimi — can gönder/iste, ziyarette yardım (arkadaş başına günde 1),
// gelen kutusu, arkadaş sıralaması
Future<dynamic> giftSend(String code, String kind) => _rpc('gc_gift_send', {'p_token': _tok(), 'p_code': code, 'p_kind': kind});
Future<dynamic> inbox() => _rpc('gc_inbox', {'p_token': _tok()});

Future<dynamic> friendLb() async {
  _syncTimer?.cancel();
  await _pushCloud();
  return _rpc('gc_friend_lb', {'p_token': _tok()});
}

const Map<String, int> helpReward = {'helper': 25, 'owner': 40};
const int giftLifeCap = 10; // hediye canlar üst sınırı aşabilir (max+5)

// F226: 'life' gerçekte eklenen can (üst sınırda kesilen sayılmaz), 'left' kutuda bekleyen can hediyesi
// F326 replay: yanıtı kaybolmuş alımın yeniden gönderimi. Sunucu o kimlikle eski boş yere göre aldığı canları
// döner, o hediyeler kutudan çoktan düştü; şimdiki canla kesilirse kaybolurdu → hepsi eklenir
Map<String, int> applyInbox(dynamic r, [bool replay = false]) {
  int n(String k) => (r is Map && r[k] is num) ? (r[k] as num).toInt().clamp(0, 1000) : 0;
  final life = n('life'), help = n('help');
  final before = save['lives'] as int;
  final cap = replay ? giftLifeCap + life : giftLifeCap;
  if (life != 0) save['lives'] = math.max(before, math.min(cap, before + life));
  if (help != 0) save['coins'] = (save['coins'] as int) + help * helpReward['owner']!;
  persist();
  return {'life': (save['lives'] as int) - before, 'help': help, 'coins': help * helpReward['owner']!, 'left': n('left')};
}

// F411: yardım ödülü yanıt kaybolunca kaybolmasın. İstekten önce bugünün (sunucu günü, UTC) bekleyen işareti
// (helpP[kod] = gün) yazılır. Ağ/5xx hatasında işaret kalır: sunucu yazmışsa sonraki dokunuş 'bugun_yapildi' alır ve
// önceki deneme belirsiz kaldığı için ödül bir kez verilir. Alınan ödül 'gün!' ile işaretlenir, aynı gün ikinci kez
// verilmez; bekleyen işaret yokken gelen 'bugun' (başka cihazda ya da önceden yardım edilmiş) ödül vermez.
String _helpDay() => gameNow().toUtc().toIso8601String().substring(0, 10);

Future<int> helpFriend(String code) async {
  _tok(); // hesap yoksa işaret bırakmadan hata
  final d = _helpDay();
  final m = <String, dynamic>{};
  final old = save['helpP'];
  if (old is Map) { old.forEach((k, v) { if (v is String && v.startsWith(d)) m['$k'] = v; }); } // eski günler atılır
  final was = m[code] == d;
  if (m[code] != '$d!') m[code] = d;
  save['helpP'] = m;
  persist();
  try {
    await giftSend(code, 'help');
  } on _Refused catch (e) {
    final p = obj(save, 'helpP');
    if (!e.message.contains('bugun')) { if (p[code] == d) { p.remove(code); persist(); } rethrow; } // reddedildi: yazılmadı
    if (!was) { p[code] = '$d!'; persist(); rethrow; }
  }
  obj(save, 'helpP')[code] = '$d!';
  save['coins'] = (save['coins'] as int) + helpReward['helper']!;
  persist();
  return helpReward['helper']!;
}

// F36: canlı çiftlik linki — herkese açık görüntü + cihaz başına günde 1 sulama;
// sahibi girişte toplar
Future<dynamic> publicFarm(String code) => _rpc('gc_public_farm', {'p_code': code});

String deviceId() {
  try {
    final local = Store.localDevice;
    if (local != null) return local;
    var d = Store.getItem('gc_dev');
    if (Store.deviceFileReady) {
      // F295: 'gc_dev_v' ayarı varsa bu ayarlar yedekten gelmiş, kimlik dosyası gelmemiş: yeni telefon
      // yeni kimlik alır. Ayar yoksa eski sürümden geçiş: aynı telefon, eski kimlik korunur.
      if (d == null || Store.getItem('gc_dev_v') == '1') d = _uuid();
      if (Store.setLocalDevice(d)) { Store.setItem('gc_dev_v', '1'); Store.removeItem('gc_dev'); }
      else { Store.setItem('gc_dev', d); Store.removeItem('gc_dev_v'); } // dosya yazılamadı: eski yol, sonraki açılışta da aynı kimlik
      return d;
    }
    if (d == null) { d = _uuid(); Store.setItem('gc_dev', d); }
    return d;
  } catch (_) {
    return 'tmp-${_now()}-${math.Random().nextDouble().toString().substring(2)}';
  }
}

Future<dynamic> publicWater(String code) => _rpc('gc_public_water', {'p_code': code, 'p_device': deviceId()});
Future<dynamic> waterClaimRaw() => claimOnce('gc_water_claim', {});
String farmLink(String code, [String base = '']) => '$base?ciftlik=${Uri.encodeComponent(code)}';
// F88: promosyon kodu + admin hediyesi — sunucu ödülü döner, kayda burada eklenir
Map<String, int> applyReward(dynamic r) {
  int n(String k) => r is Map && r[k] is num ? (r[k] as num).toInt().clamp(0, 100000) : 0;
  final out = {'coins': n('coins'), 'gems': n('gems'), 'stars': n('stars'), 'lives': n('lives')};
  if (out.values.every((v) => v == 0)) return out;
  save['coins'] = (save['coins'] as int) + out['coins']!;
  save['gems'] = (save['gems'] as int) + out['gems']!;
  save['bonusStars'] = ((save['bonusStars'] as num?)?.toInt() ?? 0) + out['stars']!;
  save['lives'] = math.max(save['lives'] as int, math.min(giftLifeCap + out['lives']!, (save['lives'] as int) + out['lives']!)); // F175
  persist();
  return out;
}

/// ok=false ise 'err' anahtarı: gecersiz / kullanildi / tukendi / suresi_doldu / cok_deneme / ag
/// F280: kod kimlikle gider (F279); yanıt kaybolursa aynı kodun sonraki denemesi (ya da açılış) aynı kimliği yollar,
/// sunucu "kullanıldı" yerine o kimlikle verdiği ödülü yeniden döner.
const _promoKey = 'gc_promo_redeem:';
Future<Map<String, dynamic>> redeemPromo(String code) async {
  try {
    final r = await claimOnce('gc_promo_redeem', {'p_code': code, 'p_device': deviceId(), 'p_token': account()?['token']}, '$_promoKey$code');
    if (r is Map && r['ok'] == true) return {'ok': true, ...applyReward(r)};
    return {'ok': false, 'err': r is Map ? '${r['err']}' : 'ag'};
  } catch (_) { return {'ok': false, 'err': 'ag'}; }
}

String rewardLabel(Map<String, int> r) => [
  if ((r['coins'] ?? 0) > 0) '🪙 +${r['coins']}',
  if ((r['gems'] ?? 0) > 0) '💎 +${r['gems']}',
  if ((r['stars'] ?? 0) > 0) '⭐ +${r['stars']}',
  if ((r['lives'] ?? 0) > 0) '❤️ +${r['lives']}',
].join('   ');

// F90: mağazadaki sürüm bilgisi {latest, min, url}; hata/ağ yoksa boş
Future<Map> appVersionInfo(String platform) async {
  try { final r = await _rpc('gc_app_version', {'p_platform': platform}); return r is Map ? r : const {}; }
  catch (_) { return const {}; }
}

/// a<b ise negatif (1.1.2 biçimi; +build yok sayılır)
int cmpVersion(String a, String b) {
  List<int> p(String v) => v.split('+').first.split('.').map((x) => int.tryParse(x) ?? 0).toList();
  final x = p(a), y = p(b);
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d;
  }
  return 0;
}

/// F280: hediye de kimlikle alınır (yanıt kaybolursa sonraki açılışta aynı kimlik gider, hediye kaybolmaz).
/// Yanıtı kaybolmuş promosyon kodları da burada yeniden denenir; ödülleri hediyeyle birlikte gösterilir.
Future<Map<String, int>> claimGrants() async {
  final out = <String, int>{};
  void add(Map r) => r.forEach((k, v) { if (v is int) out[k] = (out[k] ?? 0) + v; });
  // F301: admin panelinin misafir listesi ve hediyesi kayıttaki deviceId ile gider, gc_dev ile değil: ikisi de gönderilir
  final sd = save['deviceId'];
  try { add(applyReward(await claimOnce('gc_grant_claim', {'p_device': deviceId(), 'p_token': account()?['token'],
      if (sd is String && sd.length >= 8 && sd.length <= 64) 'p_save_device': sd}))); }
  catch (_) {}
  final codes = save['claimN'] is Map
      ? [for (final k in (save['claimN'] as Map).keys) if ('$k'.startsWith(_promoKey)) '$k'.substring(_promoKey.length)]
      : const <String>[];
  for (final c in codes) {
    final r = await redeemPromo(c);
    if (r['ok'] == true) add({for (final k in const ['coins', 'gems', 'stars', 'lives']) k: r[k]});
  }
  return out;
}

/// F256: açılış hediyeyi en çok [wait] bekler. Sunucu geç yanıt verirse hediye yine kayda eklenir ve [late] çağrılır;
/// eskiden sessizce ekleniyordu (oyuncu "Hediyen geldi!" görmüyor, grant_claim kaydı düşmüyordu).
Future<Map<String, int>> claimGrantsWithin(Duration wait, void Function(Map<String, int> g) late) {
  final f = claimGrants();
  return f.timeout(wait, onTimeout: () {
    f.then((g) { if (rewardLabel(g).isNotEmpty) late(g); });
    return const {};
  });
}

// F88: yakalanan hata sunucuya (admin panelinde "Hatalar"); aynı mesaj oturumda 1 kez
final Set<String> _sentErr = {};
void reportError(Object e, StackTrace? st) {
  final msg = '$e'.split('\n').first;
  if (Config.cloud.url.isEmpty || !_sentErr.add(msg) || _sentErr.length > 20) return;
  _rpc('gc_log_error', {'p_device': deviceId(), 'p_token': account()?['token'], 'p_version': Config.version,
    'p_message': msg, 'p_stack': '${st ?? ''}'}).catchError((_) => null);
}

// F89: gelir kaydı (satın alma + reklam) — gönderilemeyen kuyrukta kalır, sonraki çağrıda yeniden denenir
const _revKey = 'gemcrush.f89.rev';
bool _revBusy = false;
void logRevenue(Map<String, dynamic> row) {
  if (Config.cloud.url.isEmpty) return;
  try {
    final q = (jsonDecode(Store.getItem(_revKey) ?? '[]') as List).cast<Map>().toList();
    q.add(row);
    Store.setItem(_revKey, jsonEncode(q.length > 200 ? q.sublist(q.length - 200) : q));
  } catch (_) {}
  flushRevenue();
}

// F115: kuyruk her turda depodan yeniden okunur. Eskiden döngü başta okunan kopyayı geri yazıyordu;
// gönderim sürerken gelen satır (AdMob tutarı = onPaidEvent, gösterimden hemen sonra gelir) siliniyordu.
List<Map> _revQueue() {
  try { return (jsonDecode(Store.getItem(_revKey) ?? '[]') as List).cast<Map>().toList(); } catch (_) { return []; }
}

Future<void> flushRevenue() async {
  if (_revBusy || Config.cloud.url.isEmpty) return;
  _revBusy = true;
  try {
    while (true) {
      final q = _revQueue();
      if (q.isEmpty) break;
      final r = q.first;
      await _rpc('gc_log_revenue', {'p_device': deviceId(), 'p_token': account()?['token'], 'p_txn': r['txn'],
        'p_kind': r['kind'], 'p_platform': r['platform'], 'p_product': r['product'], 'p_placement': r['placement'],
        'p_amount': r['amount'], 'p_currency': r['currency'], 'p_rewarded': r['rewarded'] ?? false});
      final now = _revQueue();
      final i = now.indexWhere((m) => jsonEncode(m) == jsonEncode(r));
      if (i >= 0) now.removeAt(i);
      Store.setItem(_revKey, jsonEncode(now));
    }
  } catch (e, st) { reportError('revenue: $e', st); }
  _revBusy = false;
}

// F226: sunucu yalnız boş yer kadar can hediyesi alır, kalanı kutuda bekler (eskiden üst sınırı aşan hediye kayboluyordu)
Future<Map<String, int>> claimInbox() async {
  tickLives();
  final replay = _claimPending('gc_inbox_claim2'); // F326
  final room = math.max(0, giftLifeCap - (save['lives'] as int));
  return applyInbox(await claimOnce('gc_inbox_claim2', {'p_room': room}), replay);
}

// günlük hediye kutusu (cihazda, günde 1)
// F259: yalnız gün ileri gidince açılır (eskiden gün farklıysa açılıyordu; saati geri alıp düzeltmek kutuyu yeniden açıyordu)
bool giftBoxReady([int? now]) => (now ?? _now()) ~/ 86400000 > ((save['giftBox'] as num?)?.toInt() ?? -1);

Map<String, int>? openGiftBox([int? now, double Function()? rnd]) {
  final t = now ?? _now();
  final rand = rnd ?? math.Random().nextDouble;
  if (!giftBoxReady(t)) return null;
  save['giftBox'] = t ~/ 86400000;
  final x = rand();
  Map<String, int> r;
  if (x < 0.15) {
    r = {'gems': 1};
    save['gems'] = (save['gems'] as int) + 1;
  } else if (x < 0.4) {
    r = {'life': 1};
    save['lives'] = math.max(save['lives'] as int, math.min(giftLifeCap, (save['lives'] as int) + 1)); // F175
  } else {
    r = {'coins': 60 + (rand() * 10).floor() * 10};
    save['coins'] = (save['coins'] as int) + r['coins']!;
  }
  persist();
  return r;
}

// F126: bekleyen (2.5 sn içindeki) değişiklik düşmesin — çıkarken onu o hesaba hemen it.
// Bekleyen yoksa itme: başka cihazın daha yeni bulut kaydını eskisiyle ezmesin.
// Eşleşme bilgisi silinmez: yerel kayıt o hesabın kalır, başka hesaba girişte itilmez.
// F329: önceki itiş başarısız olduysa (çevrimdışı) bekleyen sayaç yok ama kayıt eşleşmeden ileride — onu da it.
void logout() {
  final a = account();
  final sy = a == null ? null : _synced(a['user']);
  final p = _syncTimer?.isActive == true || (sy != null && _rev(save) > sy);
  _syncTimer?.cancel();
  _setAccount(null);
  if (a != null && p) unawaited(_pushCloud(a));
}

// açılışta: bulut daha ilerideyse (eşitse son değişen oysa — F126) onu al; true dönerse sahne yenilenmeli
Future<bool> syncOnBoot() async {
  final a = account();
  if (a == null) return false;
  final lr = _rev(save); // F126: bekleme sırasında tickLives persist edebilir
  if (_sync()['user'] != a['user']) _setSync(a['user'], null); // eski kurulum: sahip bu hesap, sürüm bilinmiyor
  final synced = _synced(a['user']);
  try {
    final s = await _cloudSave(a['user'], 'gc_pull', {'p_token': a['token']});
    // F218: beklerken çıkıldıysa ya da başka hesaba girildiyse bu kayıt artık o hesabın değil: alma da itme de
    if (account()?['token'] != a['token']) return false;
    // F183: yeniden işlenen ödül eşleşmeden sonra persist eder → yerel değişmiş sayılır, sonraki itişte buluta gider
    if (cloudWins(s, save, synced: synced, localRev: lr)) { _adopt(s as Map); _setSync(a['user'], _rev(save), progressScore(save)); _regrant(); return true; }
    await _pushCloud();
  } catch (e) {
    if (RegExp('oturum').hasMatch('$e')) _dropSession(a);
  }
  return false;
}

String authError(Object? e) {
  final m = '${e ?? ''}';
  // F160: 10 yanlış denemede sunucu 'hatali_kilit' döner; 'hatali'dan önce bakılmazsa "şifre yanlış" görünür
  if (m.contains('hatali_kilit')) return 'kilit';
  // F194: kayıtta filtreye takılan kullanıcı adı (gc_aa_username tetikleyicisi) "bağlantı hatası" görünmesin
  if (m.contains('isim_uygunsuz')) return 'isim';
  return ['kullanici_adi', 'sifre_kisa', 'alinmis', 'hatali'].firstWhere((k) => m.contains(k), orElse: () => 'ag');
}

// Dev/test: geliştirme derlemesinde canlar hep dolu
const bool dev = bool.fromEnvironment('GEM_DEV');

// ---- canlar ----
void tickLives() {
  if (dev) { save['lives'] = Config.lives.max; save['lifeTs'] = _now(); return; }
  if ((save['lives'] as int) >= Config.lives.max) { save['lifeTs'] = _now(); return; }
  // F135: saat geri alındıysa lifeTs gelecekte kalır → dolum saatlerce durur; şimdiye çek
  if ((save['lifeTs'] as num).toInt() > _now()) { save['lifeTs'] = _now(); persist(); return; }
  final gained = (_now() - (save['lifeTs'] as num).toInt()) ~/ Config.lives.regenMs;
  if (gained > 0) {
    save['lives'] = math.min(Config.lives.max, (save['lives'] as int) + gained);
    save['lifeTs'] = (save['lifeTs'] as num).toInt() + gained * Config.lives.regenMs;
    if ((save['lives'] as int) >= Config.lives.max) save['lifeTs'] = _now();
    persist();
  }
}

int msToNextLife() {
  if ((save['lives'] as int) >= Config.lives.max) return 0;
  return (Config.lives.regenMs - (_now() - (save['lifeTs'] as num).toInt())).clamp(0, Config.lives.regenMs).toInt(); // F135: sayaç dolum süresini aşmaz
}

bool spendLife() {
  tickLives();
  if (dev) { save['lives'] = Config.lives.max; return true; }
  if ((save['lives'] as int) <= 0) return false;
  if ((save['lives'] as int) == Config.lives.max) save['lifeTs'] = _now();
  save['lives'] = (save['lives'] as int) - 1;
  persist();
  return true;
}

// Can yalnız KAYBEDİNCE gider. Bölüm başında "askıda" işaretlenir; kazanınca silinir,
// kaybedince/çıkınca can düşülür. Uygulama bölüm ortasında kapatılırsa açılışta düşülür.
// F180: bu çalıştırmada başlayan bölüm açılış hesabına karışmaz (link ziyareti → çiftlik → bölüm, eşitleme bitmeden)
bool _levelBegun = false;
void beginLevel(int id) { _levelBegun = true; save['inLevel'] = id; persist(); }

void endLevel(bool won) {
  if ((save['inLevel'] as num).toInt() == 0) return;
  save['inLevel'] = 0;
  if (!won) { spendLife(); } else { persist(); }
}

// F180: bölüm ortasında öldürülen uygulama açılışta kaybetmiş sayılır (can + seri) — yoksa kapatıp kaçmak can/seriyi korurdu
void settlePendingLevel() {
  final id = iOf(save['inLevel']);
  if (id == 0 || _levelBegun) return;
  track('level_abandon', {'level': id});
  recordLoss();
  endLevel(false);
}
// F175: can eklemek canı asla düşürmez (hediyeyle 7 canken +1 → 5'e iniyordu); cap: satın alma/dolum 5, ödül giftLifeCap
void addLife([int n = 1, int? cap]) { final l = save['lives'] as int; save['lives'] = math.max(l, math.min(cap ?? Config.lives.max, l + n)); persist(); }

// ---- para ----
void addCoins(int n) { save['coins'] = (save['coins'] as int) + n; persist(); }
void addGems(int n) { save['gems'] = (save['gems'] as int) + n; persist(); }
bool spendGems(int n) { if ((save['gems'] as int) < n) return false; save['gems'] = (save['gems'] as int) - n; persist(); return true; }
bool spendCoins(int n) { if ((save['coins'] as int) < n) return false; save['coins'] = (save['coins'] as int) - n; persist(); return true; }

// ---- ilerleme ----
// Bu kazanımın çiftliğe kaç YENİ yıldız kattığını döndürür (yalnız iyileşme sayılır,
// tekrar oynayarak yıldız çiftçiliği yapılamaz).
int recordWin(int levelId, int score, int stars) {
  final k = '$levelId';
  final st = save['stars'] as Map;
  final bs = save['best'] as Map;
  final prev = (st[k] as num?)?.toInt() ?? 0;
  st[k] = math.max(prev, stars);
  bs[k] = math.max((bs[k] as num?)?.toInt() ?? 0, score);
  if (levelId >= (save['level'] as int)) save['level'] = levelId + 1;
  save['levelsPlayed'] = (save['levelsPlayed'] as int) + 1;
  persist();
  clanAdd(levelId, stars); // F65: ekibe haftalık yıldız
  raceAdd(levelId, stars); // F61: yarışa yıldız bildir (hesap yoksa/aktif yarış yoksa sessiz)
  return math.max(0, stars - prev);
}

void recordLoss() {
  save['levelsPlayed'] = (save['levelsPlayed'] as int) + 1;
  final ws = save['winStreak'] is int ? save['winStreak'] as int : 0; // F60
  if (ws >= 2) track('streak_lost', {'streak': ws});
  save['winStreak'] = 0;
  persist();
}
int winStreak() => save['winStreak'] is int ? save['winStreak'] as int : 0; // F60

// ---- günlük ödül ----
class DailyStatus {
  final bool available;
  final int streak, reward;
  const DailyStatus(this.available, this.streak, this.reward);
}

/// Günlük ödül modalı bu oturumda bir kez gösterildi mi?
/// (Kapatıp başka sahneye geçince tekrar açılmasın diye.)
bool dailyModalShown = false;

DailyStatus dailyStatus([int? now]) {
  final day = (now ?? _now()) ~/ 86400000;
  final d = save['daily'] as Map;
  final last = (d['last'] as num).toInt();
  // F259: alınan günden önceki bir gün de "alındı" sayılır (saati geri alıp ödülü yeniden almak kapandı)
  if (day <= last) return DailyStatus(false, (d['streak'] as num).toInt(), 0);
  final streak = last == day - 1 ? (d['streak'] as num).toInt() % 7 : 0; // F78: 7 günde bir başa döner
  return DailyStatus(true, streak, Config.dailyRewards[math.min(streak, Config.dailyRewards.length - 1)]);
}

int claimDaily([int? now]) {
  final t = now ?? _now();
  final s = dailyStatus(t);
  if (!s.available) return 0;
  save['daily'] = {'last': t ~/ 86400000, 'streak': s.streak + 1};
  addCoins(s.reward);
  if (s.streak == 6) { // F78: 7. gün ayrıca 💎 + 🔨
    addGems(1);
    final b = save['boosters'] as Map;
    b['hammer'] = ((b['hammer'] as num?) ?? 0).toInt() + 1;
    persist();
  }
  return s.reward;
}

// ---- çiftlik yıldızları (cüzdan) ----
int totalStars() => (save['stars'] as Map).values.fold<int>(0, (a, n) => a + (n is num ? n.toInt() : 0));
int starBalance() => math.max(0, totalStars() + ((save['bonusStars'] as num?)?.toInt() ?? 0) - (save['starsSpent'] as num).toInt()); // F88: promosyon/hediye yıldızı bonusStars'ta
bool spendStars(int n) { if (starBalance() < n) return false; save['starsSpent'] = (save['starsSpent'] as num).toInt() + n; persist(); return true; }

// F38: oyuncu pazarı — hesaplı çağrı (token eklenir)
Future<dynamic> acctRpc(String fn, [Map<String, dynamic> body = const {}]) => _rpc(fn, {'p_token': _tok(), ...body});

// ---- F61: yıldız yarışı (sunucu seviye başına en çok 3★ sayar) ----
Future<dynamic> raceBoard() => _rpc('gc_race_board', {'p_token': _tok()});
Future<dynamic> raceJoin() => _rpc('gc_race_join', {'p_token': _tok()});
void raceAdd(int level, int stars) {
  if (account() == null) return;
  _rpc('gc_race_add', {'p_token': _tok(), 'p_level': level, 'p_stars': stars}).catchError((_) => null);
}
Future<Map<String, int>> raceClaim() async {
  final r = await claimOnce('gc_race_claim', {});
  final g = r is Map ? (r['gems'] as num?)?.toInt() ?? 0 : 0, c = r is Map ? (r['coins'] as num?)?.toInt() ?? 0 : 0;
  if (g > 0) addGems(g);
  if (c > 0) addCoins(c);
  persist(); // F279: ödül yoksa da kimliğin silinmesi kayda geçsin
  return {'rank': r is Map ? (r['rank'] as num?)?.toInt() ?? 0 : 0, 'gems': g, 'coins': c};
}

// ---- F65: Tarla Ekibi (klan) — sunucu bölüm başına haftada en çok 3★ sayar ----
Future<dynamic> clanMe() => _rpc('gc_clan_me', {'p_token': _tok()});
Future<dynamic> clanList([String q = '']) => _rpc('gc_clan_list', {'p_token': _tok(), 'p_q': q});
Future<dynamic> clanCreate(String name) => _rpc('gc_clan_create', {'p_token': _tok(), 'p_name': name});
// F72: ayrı ekip paneli — kurma ayarları, başvuru onayı, rol, atma
Future<dynamic> clanCreate2(String name, String emoji, String mode, int minLvl) =>
    _rpc('gc_clan_create2', {'p_token': _tok(), 'p_name': name, 'p_emoji': emoji, 'p_mode': mode, 'p_min': minLvl});
Future<dynamic> clanAnswer(String uid, bool ok) => _rpc('gc_clan_answer', {'p_token': _tok(), 'p_uid': uid, 'p_ok': ok});
Future<dynamic> clanKick(String uid) => _rpc('gc_clan_kick', {'p_token': _tok(), 'p_uid': uid});
Future<dynamic> clanSetRole(String uid, String role) => _rpc('gc_clan_setrole', {'p_token': _tok(), 'p_uid': uid, 'p_role': role});
Future<dynamic> clanSettings(String mode, int minLvl) => _rpc('gc_clan_settings', {'p_token': _tok(), 'p_mode': mode, 'p_min': minLvl});
Future<dynamic> clanMsgs(int since) => _rpc('gc_clan_msgs', {'p_token': _tok(), 'p_since': since});
Future<dynamic> clanSay(String body) => _rpc('gc_clan_say', {'p_token': _tok(), 'p_body': body});
Future<dynamic> clanUnsay(int id) => _rpc('gc_clan_unsay', {'p_token': _tok(), 'p_id': id});
Future<dynamic> clanLeague() => _rpc('gc_clan_league', {'p_token': _tok()});
Future<dynamic> clanJoin(int id) => _rpc('gc_clan_join', {'p_token': _tok(), 'p_id': id});
Future<dynamic> clanLeave() => _rpc('gc_clan_leave', {'p_token': _tok()});
Future<dynamic> clanHelp() => _rpc('gc_clan_help', {'p_token': _tok()});
Future<dynamic> clanGive(int req) => _rpc('gc_clan_give', {'p_token': _tok(), 'p_req': req});
void clanAdd(int level, int stars) {
  if (account() == null) return;
  _rpc('gc_clan_add', {'p_token': _tok(), 'p_level': level, 'p_stars': stars}).catchError((_) => null);
}
Future<Map<String, int>> clanChest() async {
  final r = await claimOnce('gc_clan_chest', {});
  final g = r is Map ? (r['gems'] as num?)?.toInt() ?? 0 : 0, c = r is Map ? (r['coins'] as num?)?.toInt() ?? 0 : 0;
  if (g > 0) addGems(g);
  if (c > 0) addCoins(c);
  persist();
  return {'gems': g, 'coins': c};
}
// F75: düello / hafta sonu etkinliği ödülü — miktar sunucuda, tek sefer
Future<int> clanClaim(String kind) async {
  final r = await claimOnce('gc_clan_claim', {'p_kind': kind}, 'gc_clan_claim:$kind');
  final c = r is Map ? (r['coins'] as num?)?.toInt() ?? 0 : 0;
  if (c > 0) addCoins(c);
  persist();
  return c;
}

// F66: arkadaşa ürün hediyesi — günde 3 gönderim, gönderim başına ≤10, yalnız temel ürünler.
// Ürün gönderimde hemen ambardan düşer (sunucu açıkça reddederse geri konur); alıcı çiftliğe girince toplar.
const List<String> giftGoods = ['egg', 'milk', 'wool', 'honey', 'wheat', 'corn'];
const int giftMaxQty = 10, giftPerDay = 3;

Future<int> goodsGiftLeft() async => ((await _rpc('gc_pgift_left', {'p_token': _tok()})) as num?)?.toInt() ?? 0;

// F135: gönderim sürerken ikinci dokunuş yok sayılır; ürün await'ten ÖNCE düşer, hata olursa geri konur
// (eskiden çift dokunuşta iki gönderim gidiyor, ambar eksiye düşüyordu)
bool _giftSending = false;
bool get goodsGiftBusy => _giftSending;

Future<int> goodsGiftSend(String code, String good, int qty) async {
  if (_giftSending) throw 'mesgul';
  final inv = obj(obj(save, 'farm'), 'inv');
  if (!giftGoods.contains(good) || qty < 1 || qty > giftMaxQty || iOf(inv[good]) < qty) throw 'adet';
  _giftSending = true;
  try {
    final r = await _giftSend({'fn': 'p', 'code': code, 'good': good, 'qty': qty});
    return (r is Map && r['left'] is num) ? (r['left'] as num).toInt() : 0;
  } finally {
    _giftSending = false;
  }
}

/// F300: ürün hediyesi tek seferlik kimlikle gider (F279'un gönderim tarafı). Eskiden HER hatada ürün geri
/// konuyordu: sunucu hediyeyi yazıp yanıt kaybolunca (5xx, bağlantı koptu) alıcı ürünü alıyor, gönderen de geri
/// alıyordu. Şimdi ürün düşer, hediye kimliğiyle kayıtta (giftP) bekler; yalnız sunucu açıkça reddedince geri
/// konur. Belirsiz hatada ürün düşük kalır, sonraki gönderimde ya da çiftliğe girişte aynı kimlik yeniden gider;
/// sunucu o kimlikle yazılmış hediyeyi ikinci kez yazmaz. Sonucu belli olmayan hediye varken yenisi gitmez.
final Set<String> _giftFlying = {};

Map _giftQ() => save['giftP'] is Map ? save['giftP'] as Map : const {};

bool _giftStale() => _giftQ().keys.any((n) => !_giftFlying.contains('$n'));

// kimlik bakıldıktan sonraki retler: bu kimlikle yazılmış hediye yok, ürün geri konabilir
const Set<String> _giftNo = {'tur', 'adet', 'arkadas_degil', 'gunluk_dolu', 'uye_degil', 'bugun_yapildi'};

Future<dynamic> _giftSend(Map<String, dynamic> g) async {
  if (Config.cloud.url.isEmpty) throw Exception('offline');
  _tok(); // hesapsız gönderim yok (ürün düşmeden)
  if (_giftStale()) {
    await _giftFlush();
    if (_giftStale()) throw Exception('ag');
    _tok(); // bekleyen denenirken hesaptan çıkılmış olabilir: ürün düşmesin
  }
  final inv = obj(obj(save, 'farm'), 'inv');
  if (iOf(inv[g['good']]) < iOf(g['qty'])) throw 'adet'; // bekleyen denenirken stok değişmiş olabilir
  final n = _uuid();
  inv[g['good']] = iOf(inv[g['good']]) - iOf(g['qty']);
  obj(save, 'giftP')[n] = g;
  persist();
  _giftFlying.add(n);
  try {
    return await _giftCall(n, true);
  } finally {
    _giftFlying.remove(n);
  }
}

// fresh: kimlik az önce oluştu, daha önce hiç gitmedi → her ret kesin, ürün geri konur. Yeniden denemede ret
// kimliğe bakılmadan önce de gelebilir: oturum ve 400 dışı retler (404 fonksiyon yok, 401/403 yetki) bekler,
// sonra yeniden denenir; diğer 400 retleri (nonce) ürün geri konmadan düşer (çoğalma yok).
Future<dynamic> _giftCall(String n, bool fresh) async {
  final g = _giftQ()[n];
  final pg = g is Map && g['fn'] == 'p';
  if (g is! Map || !giftGoods.contains(g['good']) || iOf(g['qty']) < 1 || iOf(g['qty']) > giftMaxQty ||
      (pg ? g['code'] is! String : g['fn'] != 'c' || g['to'] is! String)) {
    if (g != null) _giftDone(n, false);
    throw Exception('ag');
  }
  try {
    final r = await _rpc(pg ? 'gc_pgift_send' : 'gc_cgift_send', {
      'p_token': _tok(),
      if (pg) 'p_code': g['code'] else 'p_to': g['to'],
      (pg ? 'p_good' : 'p_kind'): g['good'],
      'p_qty': iOf(g['qty']),
      'p_nonce': n,
    });
    _giftDone(n, false);
    return r;
  } on _Refused catch (e) {
    if (fresh || _giftNo.contains(e.message)) {
      _giftDone(n, true);
    } else if (e.message != 'oturum' && e.status == 400) {
      _giftDone(n, false);
    }
    rethrow;
  }
}

// await sırasında kayıt yenilenmiş olabilir: yalnız kayıtta hâlâ duran kimliğin ürünü geri konur
void _giftDone(String n, bool refund) {
  final p = obj(save, 'giftP');
  final g = p.remove(n);
  if (p.isEmpty) save.remove('giftP');
  if (refund && g is Map && giftGoods.contains(g['good'])) {
    final inv = obj(obj(save, 'farm'), 'inv');
    inv[g['good']] = iOf(inv[g['good']]) + iOf(g['qty']).clamp(0, giftMaxQty);
  }
  persist();
}

Future<void> _giftFlush() async {
  for (final n in _giftQ().keys.map((k) => '$k').toList()) {
    if (_giftFlying.contains(n)) continue;
    _giftFlying.add(n);
    try {
      await _giftCall(n, false);
    } catch (_) {
    } finally {
      _giftFlying.remove(n);
    }
  }
}

/// F300: yanıtı kaybolmuş ürün hediyeleri çiftliğe girişte aynı kimlikle yeniden denenir.
/// F300: sonucu belli olmayan hediye var (ürün düştü, gönderim bekliyor)
bool get goodsGiftPending => _giftQ().isNotEmpty;

Future<void> retryGifts() async {
  if (_giftQ().isEmpty || account() == null || Config.cloud.url.isEmpty) return;
  await _giftFlush();
}

List<Map<String, dynamic>> applyGoodsGifts(dynamic r) {
  if (r is! List || r.isEmpty) return const [];
  final inv = obj(obj(save, 'farm'), 'inv');
  final out = <Map<String, dynamic>>[];
  for (final g in r) {
    if (g is! Map || !giftGoods.contains(g['good'])) continue;
    final q = iOf(g['qty']).clamp(0, giftMaxQty);
    inv[g['good']] = iOf(inv[g['good']]) + q;
    out.add({'good': g['good'], 'qty': q, 'name': '${g['name'] ?? ''}'});
  }
  persist();
  return out;
}

Future<List<Map<String, dynamic>>> claimGoodsGifts() async => applyGoodsGifts(await claimOnce('gc_pgift_claim', {}));

// F78: ekip hediyesi — ekip üyesine günde 1 kez ❤️ can ya da 1 ürün. Can gc_inbox, ürün gc_pgift ile teslim.
Future<List<String>> clanGiftSent() async {
  final r = await _rpc('gc_cgift_sent', {'p_token': _tok()});
  return r is List ? r.map((e) => '$e').toList() : <String>[];
}

// F188: ürün await'ten ÖNCE düşer (eskiden gönderim sürerken başka üyeye aynı tek ürün de gidiyordu, ambar
// eksiye düşüyordu). F300: ürün kimlikle gider, yalnız açık retle geri konur; can ambara dokunmaz.
Future<void> clanGiftSend(String uid, String kind) async {
  if (kind == 'life') {
    await _rpc('gc_cgift_send', {'p_token': _tok(), 'p_to': uid, 'p_kind': kind, 'p_qty': 1, 'p_nonce': _uuid()});
    return;
  }
  final inv = obj(obj(save, 'farm'), 'inv');
  if (!giftGoods.contains(kind) || iOf(inv[kind]) < 1) throw 'adet';
  await _giftSend({'fn': 'c', 'to': uid, 'good': kind, 'qty': 1});
}

// F91: uzaktan bildirim token'ını sunucuya kaydet (sessiz; hata oyunu etkilemez)
Future<void> registerPush(String fcm, String platform, String lang) async {
  try { await _rpc('gc_push_register', {'p_device': deviceId(), 'p_token': account()?['token'], 'p_fcm': fcm, 'p_platform': platform, 'p_lang': lang}); } catch (_) {}
}

// ---- F93: Sıralama — haftalık grup (~50, yakın seviye) / arkadaşlar / tüm zamanlar ----
// kind: week | friend | all. Önce ilerlemeyi it ki kendi satırın taze olsun.
Future<dynamic> rankBoard(String kind) async {
  _syncTimer?.cancel();
  await _pushCloud();
  return _rpc('gc_rank_board', {'p_token': _tok(), 'p_kind': kind});
}

/// F279: değer getiren alımlar tek seferlik kimlikle (F278'in genel hâli). Kimlik yanıt işlenene dek kayıtta
/// durur; yanıt kaybolursa (ağ koptu, uygulama kapandı) sonraki denemede aynı kimlik gider ve sunucu o kimlikle
/// yapılmış alımın sonucunu yeniden döner (ödül kaybolmaz). key: aynı fonksiyonun ayrı alımları (ekip ödülü
/// türü, pazarda topla/iptal) ayrı kimlik taşır. Süren alım varken gelen ikinci çağrı istek atmaz, null döner.
/// Çağıran ödülü ekleyip persist eder: kimliğin silinmesi ödülle aynı kayda geçer.
final Map<String, Future<dynamic>> _claiming = {};

Future<dynamic> claimOnce(String fn, Map<String, dynamic> body, [String? key]) {
  final k = key ?? fn;
  final busy = _claiming[k];
  if (busy != null) return busy.then((_) => null, onError: (_) => null);
  final f = _claimOnce(fn, body, k);
  _claiming[k] = f;
  return f.whenComplete(() => _claiming.remove(k));
}

Future<dynamic> _claimOnce(String fn, Map<String, dynamic> body, String k) async {
  final tok = body.containsKey('p_token') ? body['p_token'] : _tok(); // F280: hediye/promosyon hesapsız da alınır
  var n = obj(save, 'claimN')[k];
  if (n is! String) { n = _uuid(); obj(save, 'claimN')[k] = n; persist(); }
  final dynamic r;
  try {
    r = await _rpc(fn, {'p_token': tok, ...body, 'p_nonce': n});
  } on _Refused {
    _claimDone(k, n); // işlem geri alındı: bu kimlikle alınmış ödül yok, bekleyen kalmasın
    persist();
    rethrow;
  }
  _claimDone(k, n); // await sırasında kayıt yenilenmiş olabilir: yalnız bu kimlik silinir
  return r;
}

void _claimDone(String k, String n) {
  final p = obj(save, 'claimN');
  if (p[k] == n) p.remove(k);
  if (p.isEmpty) save.remove('claimN');
}

bool _claimPending(String k) => save['claimN'] is Map && (save['claimN'] as Map)[k] is String;

/// F279: yanıtı kaybolmuş, düğmesi artık görünmeyen alımlar (sunucu "alındı" saydığı için) çiftliğe girişte
/// aynı kimlikle yeniden denenir. Sulama, ürün hediyesi ve pazar zaten girişte/pazarı açınca yeniden çağrılır.
/// Dönen: eklenen toplam {gems, coins, life}.
Future<Map<String, int>> retryClaims() async {
  final out = {'gems': 0, 'coins': 0, 'life': 0};
  if (save['claimN'] is! Map || account() == null) return out;
  Future<void> one(String k, Future<Map<String, int>> Function() f) async {
    if (!_claimPending(k)) return;
    try {
      final r = await f();
      for (final e in out.keys.toList()) { out[e] = out[e]! + (r[e] ?? 0); }
    } catch (_) {}
  }
  await one('gc_race_claim', raceClaim);
  await one('gc_clan_chest', clanChest);
  for (final kind in ['duel', 'ev']) {
    await one('gc_clan_claim:$kind', () async => {'coins': await clanClaim(kind)});
  }
  await one('gc_inbox_claim2', claimInbox);
  return out;
}

/// F278: yanıtı işlenmemiş bir alım var (yanıt kaybolmuş olabilir) → "ödülleri al" düğmesi açık kalır.
bool rankClaimPending() => save['rkNonce'] is String;

/// Kapanan haftaların ödüllerini toplar ve kayda ekler. Dönen: [{kind, rank, gems, coins, hammer}]
/// F278: her alım bir kimlikle gider; yanıt işlenene dek kimlik kayıtta kalır. Yanıt kaybolursa sonraki
/// denemede aynı kimlik gider ve sunucu o kimlikle alınmış ödülleri yeniden döner (ödül kaybolmaz).
/// F396: süren alım varken gelen ikinci çağrı (panel kapatılıp yeniden açıldı) istek atmaz, aynı sonucu bekler;
/// yoksa iki istek aynı kimliği taşır, sunucu aynı ödülleri iki kez döner ve ikisi de kayda eklenirdi.
Future<List<Map<String, int>>>? _rankClaiming;

Future<List<Map<String, int>>> rankClaim() =>
    _rankClaiming ??= _rankClaim().whenComplete(() => _rankClaiming = null);

Future<List<Map<String, int>>> _rankClaim() async {
  final tok = _tok();
  if (!rankClaimPending()) { save['rkNonce'] = _uuid(); persist(); }
  final r = await _rpc('gc_rank_claim', {'p_token': tok, 'p_nonce': save['rkNonce']});
  save.remove('rkNonce');
  final out = <Map<String, int>>[];
  if (r is! List) { persist(); return out; }
  int n(Map m, String k) => m[k] is num ? (m[k] as num).toInt().clamp(0, 100000) : 0;
  for (final m in r.whereType<Map>()) {
    final e = {'friend': m['kind'] == 'friend' ? 1 : 0, 'rank': n(m, 'rank'), 'gems': n(m, 'gems'), 'coins': n(m, 'coins'), 'hammer': n(m, 'hammer')};
    save['gems'] = (save['gems'] as int) + e['gems']!;
    save['coins'] = (save['coins'] as int) + e['coins']!;
    if (e['hammer']! > 0) {
      final b = save['boosters'] as Map;
      b['hammer'] = ((b['hammer'] as num?) ?? 0).toInt() + e['hammer']!;
    }
    out.add(e);
  }
  persist(); // ödül ve kimliğin silinmesi aynı kayıtta
  return out;
}

// F121: tek yönlü yıldız → altın (sunucu: gc_star_to_coin / gc_star_coin_info, oran ve günlük sınır sunucuda).
/// UI bilgisi: {rate, daily_cap, min, left_today, stars, coins}. Hesap yoksa/çevrimdışıysa null.
Future<Map?> starCoinInfo() async {
  if (account() == null) return null;
  try { final r = await _rpc('gc_star_coin_info', {'p_token': _tok()}); return r is Map ? r : null; } catch (_) { return null; }
}

/// n yıldızı altına çevirir. null = başarılı; aksi halde hata kodu:
/// 'hesap' | 'oturum' | 'miktar' | 'kapali' | 'limit' | 'yetersiz' | 'ag' | 'mesgul' (önceki çevirme sürüyor).
/// F260: önce yerel kayıt itilir; itiş düşerse çevirme gönderilmez (bulut altını bayat kalır).
/// Başarıda sunucunun harcadığı/verdiği FARK yerele eklenir: itiş ile çevirme arasında kazanılan altın ezilmez,
/// sonraki itiş de bulutta aynı toplamı yazar.
bool _s2cBusy = false;
Future<String?> starToCoin(int n) async {
  if (account() == null) return 'hesap';
  if (n < 1 || starBalance() < n) return n < 1 ? 'miktar' : 'yetersiz';
  if (_s2cBusy) return 'mesgul';
  _s2cBusy = true;
  try {
    _syncTimer?.cancel();
    if (!await _pushCloud()) return account() == null ? 'oturum' : 'ag'; // sunucu yerel yıldızları görsün
    final r = await _rpc('gc_star_to_coin', {'p_token': _tok(), 'p_stars': n});
    if (r is! Map || r['coins_gained'] is! num || r['stars_spent'] is! num) return 'ag';
    save['starsSpent'] = ((save['starsSpent'] as num?)?.toInt() ?? 0) + (r['stars_spent'] as num).toInt();
    save['coins'] = ((save['coins'] as num?)?.toInt() ?? 0) + (r['coins_gained'] as num).toInt();
    persist();
    return null;
  } catch (e) {
    for (final k in const ['oturum', 'miktar', 'kapali', 'limit', 'yetersiz']) { if ('$e'.contains(k)) return k; }
    return 'ag';
  } finally {
    _s2cBusy = false;
  }
}

