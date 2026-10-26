// F411: arkadaşa yardımın +25 altını yalnız gc_gift_send yanıtı gelince ekleniyordu. Sunucu yazıp yanıt kaybolunca
// (ağ, 5xx) ödül eklenmiyor, tekrar dokunuş 'bugun_yapildi' alıp "bugün yardım ettin" diyordu: ödül hiç gelmiyordu.
// Şimdi istekten önce bekleyen işaret yazılır; belirsiz denemeden sonra gelen 'bugun' ödülü bir kez verir.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:farmtastic/meta/save.dart';
import 'package:farmtastic/meta/store.dart';

const _akey = 'gemcrush.account.v1';

typedef _Reply = Future<http.Response> Function();

MockClient _server(List<Map> bodies, List<_Reply> replies) => MockClient((req) async {
      if (req.url.pathSegments.last != 'gc_gift_send') return http.Response('null', 200);
      bodies.add(jsonDecode(req.body) as Map);
      return replies.removeAt(0)();
    });

Future<http.Response> _lost() async => throw http.ClientException('Connection closed while receiving data');
Future<http.Response> _gw() async => http.Response('{}', 503);
Future<http.Response> _ok() async => http.Response(jsonEncode(<String, dynamic>{'ok': true}), 200);
_Reply _refuse(String m) => () async => http.Response(jsonEncode(<String, dynamic>{'message': m}), 400);

Map _marks() => (save['helpP'] as Map?) ?? const <String, dynamic>{};

void main() {
  setUp(() {
    Store.setItem(_akey, jsonEncode({'user': 't', 'token': 'tok'}));
    save['coins'] = 100;
    save.remove('helpP');
  });
  tearDown(() => Store.removeItem(_akey));

  test('sunucu yazdı, yanıt 5xx ile kayboldu: sonraki dokunuşun bugun cevabı ödülü bir kez verir', () async {
    final bodies = <Map>[];
    final s = _server(bodies, [_gw, _refuse('bugun_yapildi'), _refuse('bugun_yapildi')]);
    await http.runWithClient(() async {
      await expectLater(helpFriend('ABC'), throwsA(anything));
      expect(save['coins'], 100);
      expect(await helpFriend('ABC'), 25);
      expect(save['coins'], 125);
      // aynı gün üçüncü dokunuş: ödül tekrar gelmez
      await expectLater(helpFriend('ABC'), throwsA(predicate((e) => '$e'.contains('bugun'))));
      expect(save['coins'], 125);
    }, () => s);
    expect(bodies.length, 3);
    expect(bodies.every((b) => b['p_kind'] == 'help' && b['p_code'] == 'ABC'), isTrue);
  });

  test('istek sunucuya ulaşmadı: sonraki başarılı dokunuş ödülü bir kez verir', () async {
    final s = _server([], [_lost, _ok, _refuse('bugun_yapildi')]);
    await http.runWithClient(() async {
      await expectLater(helpFriend('ABC'), throwsA(anything));
      expect(save['coins'], 100);
      expect(await helpFriend('ABC'), 25);
      await expectLater(helpFriend('ABC'), throwsA(anything));
    }, () => s);
    expect(save['coins'], 125);
  });

  test('bekleyen işaret yokken bugun (başka yerde yardım edilmiş): ödül yok; red işareti düşürür', () async {
    final s = _server([], [_refuse('bugun_yapildi'), _refuse('arkadas_degil'), _refuse('bugun_yapildi')]);
    await http.runWithClient(() async {
      await expectLater(helpFriend('ABC'), throwsA(anything));
      expect(save['coins'], 100);
      await expectLater(helpFriend('XYZ'), throwsA(anything));
      expect(_marks().containsKey('XYZ'), isFalse);
      // reddedilen deneme belirsiz sayılmaz: ardından gelen bugun ödül vermez
      await expectLater(helpFriend('XYZ'), throwsA(anything));
    }, () => s);
    expect(save['coins'], 100);
  });

  test('düz başarı: +25, eski günlerin işaretleri atılır', () async {
    save['helpP'] = <String, dynamic>{'OLD': '2000-01-01', 'OLD2': '2000-01-01!'};
    final s = _server([], [_ok]);
    await http.runWithClient(() async {
      expect(await helpFriend('ABC'), 25);
    }, () => s);
    expect(save['coins'], 125);
    expect(_marks().keys, ['ABC']);
    expect('${_marks()['ABC']}'.endsWith('!'), isTrue);
  });
}
