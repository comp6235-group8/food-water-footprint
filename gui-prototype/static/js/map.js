var createMap = function (ingredient) {
    $(document).ready(function() {
        d3.json("/data/ingredient/waterfootprint/" + ingredient, function (error, data) {
            if ($.isEmptyObject(data)) {
                $("#canvas-svg").empty();
                $("#wf-country-label").html("No water footprint data for " + ingredient);
                return;
            }
            $("#wf-country-label").html("Water footprint per country for " + data.product);

            data = data.countries;

            data.forEach(function (country) {
                ["blue", "green", "grey"].forEach(function (color) {
                    if (!country["water_footprint_country_average"][color]) {
                        country["water_footprint_country_average"][color] = null;
                    }
                });
            });

            var config = {"data0":"country","data1":"water_footprint_country_average",
                "label0":"label 0","label1":"label 1","color0":"#99ccff","color1":"#0050A1",
                "width":960,"height":960
            };

            var width = config.width;
            var height = config.height;

            var COLOR_COUNTS = 9;

            function Interpolate(start, end, steps, count) {
                var s = start,
                    e = end,
                    final = s + (((e - s) / steps) * count);
                return Math.floor(final);
            }

            function Color(_r, _g, _b) {
                var r, g, b;
                var setColors = function(_r, _g, _b) {
                    r = _r;
                    g = _g;
                    b = _b;
                };

                setColors(_r, _g, _b);
                this.getColors = function() {
                    var colors = {
                        r: r,
                        g: g,
                        b: b
                    };
                    return colors;
                };
            }

            function hexToRgb(hex) {
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }

            function valueFormat(d) {
                return Math.round(d);
            }

            var COLOR_FIRST = config.color0, COLOR_LAST = config.color1;

            var rgb = hexToRgb(COLOR_FIRST);

            var COLOR_START = new Color(rgb.r, rgb.g, rgb.b);

            rgb = hexToRgb(COLOR_LAST);
            var COLOR_END = new Color(rgb.r, rgb.g, rgb.b);

            var startColors = COLOR_START.getColors(),
                endColors = COLOR_END.getColors();

            var colors = [];

            for (var i = 0; i < COLOR_COUNTS; i++) {
                var r = Interpolate(startColors.r, endColors.r, COLOR_COUNTS, i);
                var g = Interpolate(startColors.g, endColors.g, COLOR_COUNTS, i);
                var b = Interpolate(startColors.b, endColors.b, COLOR_COUNTS, i);
                colors.push(new Color(r, g, b));
            }

            var MAP_KEY = config.data0;
            var MAP_VALUE = config.data1;

            var projection = d3.geo.mercator()
                .scale((width + 1) / 2 / Math.PI)
                .translate([width / 2, height / 2])
                .precision(.1);

            var path = d3.geo.path()
                .projection(projection);

            var graticule = d3.geo.graticule();

            $("#canvas-svg").empty();

            var svg = d3.select("#canvas-svg").append("svg")
                .attr("width", width)
                .attr("height", height);

            svg.append("path")
                .datum(graticule)
                .attr("class", "graticule")
                .attr("d", path);

            var valueHash = {};

            function log10(val) {
                return Math.log(val);
            }

            data.forEach(function(d) {
                valueHash[d[MAP_KEY]] = +d[MAP_VALUE]["green"] + d[MAP_VALUE]["blue"] + d[MAP_VALUE]["grey"];
            });

            footprintHash = {};
            data.forEach(function (d) {
                footprintHash[d[MAP_KEY]] = {
                    "green": +d[MAP_VALUE]["green"],
                    "blue": +d[MAP_VALUE]["blue"],
                    "grey": +d[MAP_VALUE]["grey"]
                }
            });

            var quantize = d3.scale.quantize()
                .domain([0, 1.0])
                .range(d3.range(COLOR_COUNTS).map(function(i) { return i }));

            quantize.domain([d3.min(data, function(d){
                return (+d[MAP_VALUE]["green"] + d[MAP_VALUE]["blue"] + d[MAP_VALUE]["grey"]) }),
                d3.max(data, function(d){
                    return (+d[MAP_VALUE]["green"] + d[MAP_VALUE]["blue"] + d[MAP_VALUE]["grey"]) })]);


            d3.json("https://s3-us-west-2.amazonaws.com/vida-public/geo/world-topo-min.json", function(error, world) {
                var countries = topojson.feature(world, world.objects.countries).features;

                svg.append("path")
                    .datum(graticule)
                    .attr("class", "choropleth")
                    .attr("d", path);

                var g = svg.append("g");

                g.append("path")
                    .datum({type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]})
                    .attr("class", "equator")
                    .attr("d", path);

                var country = g.selectAll(".country").data(countries);

                country.enter().insert("path")
                    .attr("class", "country")
                    .attr("d", path)
                    .attr("id", function(d,i) { return d.id; })
                    .attr("title", function(d) { return d.properties.name; })
                    .style("fill", function(d) {
                        if (valueHash[mapToCountry(d.properties.name)]) {
                            var c = quantize((valueHash[mapToCountry(d.properties.name)]));
                            var color = colors[c].getColors();
                            return "rgb(" + color.r + "," + color.g +
                                "," + color.b + ")";
                        } else {
                            return "#ccc";
                        }
                    })
                    .on("mousemove", function(d) {
                        // countryOnMap = d.properties.name;
                        countryOnMap = mapToCountry(d.properties.name);

                        var html = "";

                        html += "<div class=\"tooltip_kv\">";
                        html += "<span class=\"tooltip_key\">";
                        html += countryOnMap;
                        html += "</span>";
                        html += "<span class=\"tooltip_value\">";
                        html += "<b>";
                        html += (valueHash[countryOnMap] ? valueFormat(valueHash[countryOnMap]) : "");
                        html += "</b>";
                        html += "";
                        html += "</span>";
                        html += "<div>";
                        html += "Green footprint: ";
                        html += "<span class=\"tooltip_value\">";
                        html += (footprintHash[countryOnMap]["green"] ? valueFormat(footprintHash[countryOnMap]["green"]) : "N/A");
                        html += "";
                        html += "</span>";
                        html += "</div>";
                        html += "<div>";
                        html += "Blue footprint: ";
                        html += "<span class=\"tooltip_value\">";
                        html += (footprintHash[countryOnMap]["blue"] ? valueFormat(footprintHash[countryOnMap]["blue"]) : "N/A");
                        html += "";
                        html += "</span>";
                        html += "</div>";
                        html += "<div>";
                        html += "Grey footprint: ";
                        html += "<span class=\"tooltip_value\">";
                        html += (footprintHash[countryOnMap]["grey"] ? valueFormat(footprintHash[countryOnMap]["grey"]) : "N/A");
                        html += "";
                        html += "</span>";
                        html += "</div>";
                        html += "</div>";

                        $("#tooltip-container").html(html);
                        $(this).attr("fill-opacity", "0.8");
                        $("#tooltip-container").show();

                        var coordinates = d3.mouse(this);

                        var map_width = $('.choropleth')[0].getBoundingClientRect().width;

                        if (d3.event.pageX < map_width / 2) {
                            d3.select("#tooltip-container")
                                .style("top", (d3.event.layerY + 15) + "px")
                                .style("left", (d3.event.layerX + 15) + "px");
                        } else {
                            var tooltip_width = $("#tooltip-container").width();
                            d3.select("#tooltip-container")
                                .style("top", (d3.event.layerY + 15) + "px")
                                .style("left", (d3.event.layerX - tooltip_width - 30) + "px");
                        }
                    })
                    .on("mouseout", function() {
                        $(this).attr("fill-opacity", "1.0");
                        $("#tooltip-container").hide();
                    });

                g.append("path")
                    .datum(topojson.mesh(world, world.objects.countries, function(a, b) { return a !== b; }))
                    .attr("class", "boundary")
                    .attr("d", path);

                svg.attr("height", config.height * 2.2 / 3);
            });
            d3.select(self.frameElement).style("height", (height * 2.3 / 3) + "px");
        });
    });
}

function mapToCountry (country) {
    var countryMapper = {
        "United States": "United States of America",
        "South Korea": "Korea, Democratic People's Republic of",
        "Iran": "Iran, Islamic Republic of",
        "Bolivia, Plurinational State of": "Bolivia",
        "Venezuela": "Venezuela, Bolivarian Republic of",
        "Libya": "Libyan Arab Jamahiriya",
        "Democratic Republic of Congo": "Congo, Democratic Republic of",
        "Tanzania": "Tanzania, United Republic of"
    };
    return countryMapper[country] ? countryMapper[country] : country;
}
