ymaps.ready(init);
var myMap;

function init() {
    myMap = new ymaps.Map("map", {
        center: [56.839373, 60.610969],
        zoom: 16
    }, {
        searchControlProvider: 'yandex#search'
    });

    var myCircle;

    myMap.events.add('click', function (e) {
        if (!myMap.balloon.isOpen()) {
            let coords = e.get('coords');
            myMap.geoObjects.removeAll();



            fetch(`http://192.168.242.203:5000/vk?lat=${coords[0]}&lon=${coords[1]}`)
                .then(response => response.json())
                .then(jsons => {
                    let ageMediana = jsons["age_mediana"];
                    let fRatio = jsons["f_ratio"];
                    let mRatio = jsons["m_ratio"];
                    let randomPaymentSum = (Math.random()*100) + 1;
                    myCircle = new ymaps.Circle([coords, 350], {
                        balloonContent: `Медиана возрастов: ${ageMediana}<br>Процент женского пола: ${fRatio}<br>Процент мужского: ${mRatio}<br>Рэйтинг денежности: ${randomPaymentSum.toPrecision(4)}/100`,
                    }, {
                        draggable: false,
                        fillColor: "#DB709333",
                        strokeColor: "#990066",
                        strokeOpacity: 0.8,
                        strokeWidth: 0.1
                    });

                    // Добавляем круг на карту.
                    myMap.geoObjects.add(myCircle);
                    myCircle.options.set('visible', true);
                    return jsons["points"].map(idAndCoords => {
                        let [{ data }] = Object.values(idAndCoords);

                        data.sort(function (dateAndCoords1, dateAndCoords2) {
                            let [date1, ,] = dateAndCoords1;
                            let [date2, ,] = dateAndCoords2;
                            if (date1 < date2) {
                                return -1;
                            } else if (date1 > date2) {
                                return 1;
                            } else {
                                return 0;
                            }
                        });
                        return data.map(dAndC => {
                            let [, lat, lon] = dAndC;
                            return [lat, lon];
                        });
                    })
                })
                .then(cc => {
                    var rate = onPolygonLoad(myCircle, cc);
                    console.log(rate);
                    return rate;
                })
                .catch(err => console.log(err))
        }
        else {
            myMap.balloon.close();
        }
    });

    function onPolygonLoad(circle, coords) {


        const intersects = coords.map(c => {
            var mr = new ymaps.multiRouter.MultiRoute({
                referencePoints: c,
                params: {
                    routingMode: 'pedestrian'
                }
            }, {wayPointVisible: true, pinVisible: true, viaPointVisible: true});
            let edges = [];
            let length1 = mr.getRoutes().getLength();
            myMap.geoObjects.add(mr);
            if (length1 > 0) {
                var r = mr.getRoutes().get(0);
                const pathsObjects = ymaps.geoQuery(r.getPaths());


                pathsObjects.each(function (path) {
                    const coordinates = path.geometry.getCoordinates();
                    for (var i = 1, l = coordinates.length; i < l; i++) {
                        edges.push({
                            type: 'LineString',
                            coordinates: [coordinates[i], coordinates[i - 1]]
                        });
                    }
                });
            }

            const routeObjects = ymaps.geoQuery(edges)
                .add(mr.getWayPoints())
                .add(mr.getViaPoints())
                .addToMap(myMap);

            const routesInside = routeObjects.searchInside(circle);

            routesInside.setOptions({
                strokeColor: '#ff0005',
                preset: 'islands#redIcon'
            });
            return routesInside.length;
        });
        console.log(intersects);
        return intersects.reduce((acc, cur) => acc + cur, 0);
    }
}
