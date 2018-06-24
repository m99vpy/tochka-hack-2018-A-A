
from flask import Flask, jsonify, request
import requests
from datetime import datetime, timedelta
import statistics

access_token = '1ec7cb531e28116b352115bef5f12bd52f0d54e12896b7704cdb12a997f1510f5854378d4f89cd42de779'

app = Flask(__name__)

RESULT_THRESHOLD = 100
LAST_DAYS = 30
DEFAULT_RADIUS = 100


def parse_items(items: list):
    xs = {}
    ages = []
    sexs = []
    for item in items:
        keys = item.keys()
        if "owner_id" in keys and "date" in keys and "lat" in keys and "long" in keys and int(item["owner_id"]) > 0:
            owner_id = item["owner_id"]
            owner = xs.get(owner_id)
            data_mas = [item["date"], item["lat"], item["long"]]
            if owner:
                xs[owner_id]["data"].append(data_mas)
            else:
                xs[owner_id] = {"data": [data_mas]}

    # user's info
    owners = ",".join([str(k) for k in xs.keys()])
    users_get = f'https://api.vk.com/method/users.get?user_ids={owners}&v=5.80&fields=birthdate,sex&access_token={access_token}'
    response = requests.get(users_get)
    j = response.json()
    if "response" in j.keys():
        for user in j['response']:
            if user['id'] in xs.keys():
                age = None
                sex = None

                if 'bdate' in user.keys() and user['bdate'].count(".") == 2:
                    bd = datetime.strptime(user['bdate'], '%d.%m.%Y')
                    age = (datetime.utcnow() - bd).days // 365
                    ages.append(age)

                if 'sex' in user.keys():
                    sex = "M"
                    if user['sex'] == 1:
                        sex = "F"
                    sexs.append(sex)

                xs[user['id']]['age'] = age
                xs[user['id']]['sex'] = sex
    return [{x: xs[x]} for x in xs], ages, sexs


@app.after_request
def after_request(response):
    header = response.headers
    header['Access-Control-Allow-Origin'] = '*'
    return response


@app.route("/")
def hello():
    return "I am fine, thanks"


@app.route("/vk")
def get_vk_photos():
    lat = float(request.args.get('lat'))
    lon = float(request.args.get('lon'))
    limit = int(request.args.get('limit', RESULT_THRESHOLD))
    last = int(request.args.get('last', LAST_DAYS))
    radius = int(request.args.get('radius', DEFAULT_RADIUS))
    print(f"LATLONG: {lat, lon}")
    start_time = (datetime.utcnow() - timedelta(days=last)).timestamp()
    u2 = f'https://api.vk.com/method/photos.search?lat={lat}&long={lon}&count=200&radius={radius}&v=5.80&start_time={start_time}&access_token={access_token}'
    response = requests.get(u2)
    j = response.json()
    if 'response' in j.keys():
        response = j['response']
        count = response['count']
        items = response['items']
        print(count)
        items, ages, sexs = parse_items(items)
        print("LEN: ", len(items))
        med = statistics.median(ages)
        print("MEDIAN: ", med)
        f_ratio = sexs.count("F") // (len(sexs) / 100)
        m_ratio = 100 - f_ratio
        print(f"F RATION: {f_ratio} M: RATION: {m_ratio}")
        return jsonify({"points": items[:limit], "age_mediana": med, "f_ratio": f_ratio, "m_ratio": m_ratio})
    else:
        return jsonify([])

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)