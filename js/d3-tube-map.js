// https://github.com/johnwalley/d3-tube-map/ v1.5.0 Copyright 2020 John Walley
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.d3 = global.d3 || {}, global.d3));
}(this, (function (exports, d3) { 'use strict';

  const DIRECTION_VECTORS = {
    N: [0, 1],
    NE: [1, 1],
    E: [1, 0],
    SE: [1, -1],
    S: [0, -1],
    SW: [-1, -1],
    W: [-1, 0],
    NW: [-1, 1],
  };

  /**
   * Return the norm of a 2-dimensional vector.
   */
  function norm2d(vector) {
    return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
  }

  /**
   * Return the cross product of a 2-dimensional vector.
   */
  function crossProd2d(a, b) {
    return a[0] * b[1] - a[1] * b[0];
  }

  /**
   * Return the dot product of a 2-dimensional vector.
   */
  function dotProd2d(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }

  /**
   * Return whether the given 2D vectors are parallel.
   */
  function areParallel(a, b) {
    return (
      crossProd2d(a, b) == 0 &&
      Math.sign(a[0]) == Math.sign(b[0]) &&
      Math.sign(a[1]) == Math.sign(b[1])
    );
  }

  /**
   * Apply a function to both components of a 2-dimensional vector.
   */
  function apply2d(fn) {
    return [0, 1].map((i) => fn(i));
  }

  /**
   * Return the given vector normalized.
   */
  function normalize(vector) {
    let norm = norm2d(vector);
    return apply2d((i) => vector[i] / norm);
  }

  /**
   * Return a vector in the direction of the provided compass bearing.
   */
  function directionVector(bearing) {
    let key = bearing.toUpperCase();
    if (!DIRECTION_VECTORS.hasOwnProperty(key)) {
      let options = Object.keys(DIRECTION_VECTORS).join(', ');
      throw new Error(
        `'${key}' is not a recognised compass bearing. Options are ${options}`
      );
    }
    return DIRECTION_VECTORS[key];
  }

  /**
   * Return the compass bearing matching the provided vector.
   */
  function compassBearing(vector) {
    let entry = Object.entries(DIRECTION_VECTORS).find(([b, vec]) =>
      areParallel(vec, vector)
    );
    if (entry === undefined) {
      throw new Error(
        `No compass bearing matches vector ${vector}. Only 45 deg angles are supported.`
      );
    }
    return entry[0];
  }

  /**
   * Return the shift required to an interchange in order to ensure that it passes
   * through the middle of the first two encountered sets of intersecting lines.
   */
  function interchangeShift(markers) {
    let line1, line2;
    markers.forEach((m) => {
      let vec = normalize(directionVector(m.dir));
      if (line1 === undefined) {
        line1 = {
          vector: vec,
          shiftMin: m.shiftNormal,
          shiftMax: m.shiftNormal,
        };
      } else if (areParallel(line1.vector, vec)) {
        let dotProd = dotProd2d(vec, line1.vector);
        line1.shiftMin = Math.min(line1.shiftMin, m.shiftNormal * dotProd);
        line1.shiftMax = Math.max(line1.shiftMax, m.shiftNormal * dotProd);
      } else if (line2 === undefined) {
        line2 = {
          vector: vec,
          shiftMin: m.shiftNormal,
          shiftMax: m.shiftNormal,
        };
      } else if (areParallel(line2.vector, vec)) {
        let dotProd = dotProd2d(vec, line2.vector);
        line2.shiftMin = Math.min(line2.shiftMin, m.shiftNormal * dotProd);
        line2.shiftMax = Math.max(line2.shiftMax, m.shiftNormal * dotProd);
      }
    });
    if (line1 === undefined) {
      // No lines encountered, so no shift needed
      return [0, 0];
    } else if (line2 === undefined) {
      // All lines are parallel, so just shift in the one direction
      let mid1 = (line1.shiftMin + line1.shiftMax) / 2;
      return [mid1 * line1.vector[1], -mid1 * line1.vector[0]];
    } else {
      // Find the centre of the two encountered sets of lines
      let crossProd = crossProd2d(line1.vector, line2.vector);
      let mid1 = (line1.shiftMin + line1.shiftMax) / 2;
      let mid2 = (line2.shiftMin + line2.shiftMax) / 2;
      return apply2d(
        (i) => (mid2 * line1.vector[i] - mid1 * line2.vector[i]) / crossProd
      );
    }
  }

  /**
   * Return an SVG instruction to move to the given point.
   */
  function svgMoveTo(point) {
    return `M${point[0]},${point[1]}`;
  }

  /**
   * Return an SVG instruction to draw a line to the given point.
   */
  function svgLineTo(point) {
    return `L${point[0]},${point[1]}`;
  }

  /**
   * Return an SVG instruction to draw a quadratic Bezier curve to the given end point,
   * using the given control point.
   */
  function svgQuadraticCurveTo(controlPoint, endPoint) {
    return `Q${controlPoint[0]},${controlPoint[1]},${endPoint[0]},${endPoint[1]}`;
  }

  /**
   * Return a function for applying a coordinate transform from line definition
   * coordinates to display coordinates.
   */
  function coordTransform(
    xScaleFn,
    yScaleFn,
    lineWidth,
    unitLength,
    shiftNormal = 0,
    shiftCoords = [0, 0]
  ) {
    let shiftScale = lineWidth / unitLength;
    return (coords, tangent, shiftTangential = 0) => [
      xScaleFn(
        coords[0] +
          shiftTangential * tangent[0] +
          shiftScale * (shiftCoords[0] + shiftNormal * tangent[1])
      ),
      yScaleFn(
        coords[1] +
          shiftTangential * tangent[1] +
          shiftScale * (shiftCoords[1] - shiftNormal * tangent[0])
      ),
    ];
  }

  function interchange(lineWidth) {
    return d3.arc()
      .innerRadius(0)
      .outerRadius(1.25 * lineWidth)
      .startAngle(0)
      .endAngle(2 * Math.PI);
  }

  function station(
    d,
    xScale,
    yScale,
    lineWidthMultiplier,
    lineWidthTickRatio
  ) {
    let lineFunction = d3.line()
      .x(function (d) {
        return xScale(d[0]);
      })
      .y(function (d) {
        return yScale(d[1]);
      });

    let tangentVector = normalize(directionVector(d.dir));
    let labelVector = normalize(directionVector(d.labelPos));

    let shiftX = d.shiftX + d.shiftNormal * tangentVector[1];
    let shiftY = d.shiftY - d.shiftNormal * tangentVector[0];

    return lineFunction([
      [
        d.x +
          shiftX * lineWidthMultiplier +
          (lineWidthMultiplier / 2.05) * labelVector[0],
        d.y +
          shiftY * lineWidthMultiplier +
          (lineWidthMultiplier / 2.05) * labelVector[1],
      ],
      [
        d.x +
          shiftX * lineWidthMultiplier +
          (lineWidthMultiplier / 2) * labelVector[0] +
          (lineWidthMultiplier / lineWidthTickRatio) * labelVector[0],
        d.y +
          shiftY * lineWidthMultiplier +
          (lineWidthMultiplier / 2) * labelVector[1] +
          (lineWidthMultiplier / lineWidthTickRatio) * labelVector[1],
      ],
    ]);
  }

  /**
   * Determine the compass bearing of the tangent to the line at each node
   * along the given line, and save under the `dir` attribute.
   */
  function populateLineDirections(line) {
    for (let nNode = 1; nNode < line.nodes.length; nNode++) {
      let currNode = line.nodes[nNode];
      let prevNode = line.nodes[nNode - 1];

      let diff = apply2d(
        (i) => Math.round(currNode.coords[i]) - Math.round(prevNode.coords[i])
      );
      let [xDiff, yDiff] = diff;

      if (xDiff == 0 && yDiff == 0) {
        throw new Error(`Repeated coordinates ${currNode.coords}`);
      }

      // If it's the first segment, calculate the initial bearing, assuming
      // a straight path
      if (nNode == 1) {
        prevNode.dir = compassBearing(diff);
      }

      let prevVector = directionVector(prevNode.dir);
      if (areParallel(prevVector, diff)) {
        // Otherwise the outgoing vector is the same as the ingoing vector.
        currNode.dir = compassBearing(diff);
        if (currNode.dir !== prevNode.dir) {
          throw new Error(
            `Direction discontinuity: ${currNode.coords} is` +
              ` not ${prevNode.dir} of ${prevNode.coords}`
          );
        }
      } else {
        // A corner is required.
        let cornerPossible =
          (Math.abs(xDiff) == 1 && Math.abs(yDiff) == 1) ||
          (Math.abs(xDiff) == 1 && Math.abs(yDiff) == 2) ||
          (Math.abs(xDiff) == 2 && Math.abs(yDiff) == 1);
        if (cornerPossible) {
          // Corners are always a simple sum of the ingoing and outgoing
          // vectors in canonical integer form.
          let prevVector = directionVector(prevNode.dir);
          let nextVector = apply2d((i) => diff[i] - prevVector[i]);
          currNode.dir = compassBearing(nextVector);
        } else {
          throw new Error(
            'Cannot draw a corner between coordinates' +
              ` ${prevNode.coords} and ${currNode.coords}`
          );
        }
      }
    }
  }

  function line(data, xScale, yScale, lineWidth, lineWidthTickRatio) {
    let path = '';

    let unitLength = Math.abs(
      xScale(1) - xScale(0) !== 0 ? xScale(1) - xScale(0) : yScale(1) - yScale(0)
    );

    let transform = coordTransform(
      xScale,
      yScale,
      lineWidth,
      unitLength,
      data.shiftNormal,
      data.shiftCoords
    );

    let endCorrection = lineWidth / (2 * lineWidthTickRatio * unitLength);

    for (let nNode = 1; nNode < data.nodes.length; nNode++) {
      let prevNode = data.nodes[nNode - 1];
      let nextNode = data.nodes[nNode];

      let prevVector = directionVector(prevNode.dir);
      let nextVector = directionVector(nextNode.dir);

      let prevVectorNorm = normalize(prevVector);
      let nextVectorNorm = normalize(nextVector);

      // If it's the first segment, move to the start point.
      if (nNode == 1) {
        let point = transform(prevNode.coords, prevVectorNorm, -endCorrection);
        path += svgMoveTo(point);
      }

      let prevPoint = transform(prevNode.coords, prevVectorNorm);
      let nextPoint = transform(
        nextNode.coords,
        nextVectorNorm,
        nNode === data.nodes.length - 1 ? endCorrection : 0
      );

      if (nextNode.dir !== prevNode.dir) {
        // The control point is chosen simply to be the intersection of the
        // ingoing and outgoing vectors.
        let controlPoint = apply2d(
          (i) =>
            (prevPoint[i] * nextVector[i] + nextPoint[i] * prevVector[i]) /
            (prevVector[i] + nextVector[i])
        );
        path += svgQuadraticCurveTo(controlPoint, nextPoint);
      } else {
        path += svgLineTo(nextPoint);
      }
    }

    return path;
  }

  function Lines(lines) {
    this.lines = lines;
  }

  function lineList (lines) {
    return new Lines(lines);
  }

  function Stations(stations) {
    this.stations = stations;
  }

  Stations.prototype.toArray = function () {
    var stations = [];

    for (var name in this.stations) {
      if (this.stations.hasOwnProperty(name)) {
        var station = this.stations[name];
        station.name = name;
        stations.push(station);
      }
    }

    return stations;
  };

  Stations.prototype.interchanges = function () {
    var interchangeStations = this.toArray();

    return interchangeStations.filter(function (station) {
      return station.marker[0].marker === 'interchange';
    });
  };

  Stations.prototype.normalStations = function () {
    var stations = this.toArray();

    var stationStations = stations.filter(function (station) {
      return station.marker[0].marker !== 'interchange';
    });

    var stationMarkers = [];

    stationStations.forEach(function (station) {
      station.marker.forEach(function (marker) {
        stationMarkers.push({
          name: station.name,
          line: marker.line,
          x: station.x,
          y: station.y,
          color: marker.color,
          dir: marker.dir,
          shiftX: marker.shiftX,
          shiftY: marker.shiftY,
          shiftNormal: marker.shiftNormal,
          labelPos: station.labelPos,
        });
      });
    });

    return stationMarkers;
  };

  function stationList (stations) {
    return new Stations(stations);
  }

  function map () {
    var margin = { top: 80, right: 80, bottom: 20, left: 80 };
    var width = 760;
    var height = 640;
    var xScale = d3.scaleLinear();
    var yScale = d3.scaleLinear();
    var lineWidth;
    var lineWidthMultiplier = 0.8;
    var lineWidthTickRatio = 3 / 2;
    var svg;
    var _data;
    var gMap;

    var listeners = d3.dispatch('click');

    function map(selection) {
      selection.each(function (data) {
        _data = transformData(data);

        var minX =
          d3.min(_data.raw, function (line) {
            return d3.min(line.nodes, function (node) {
              return node.coords[0];
            });
          }) - 1;

        var maxX =
          d3.max(_data.raw, function (line) {
            return d3.max(line.nodes, function (node) {
              return node.coords[0];
            });
          }) + 1;

        var minY =
          d3.min(_data.raw, function (line) {
            return d3.min(line.nodes, function (node) {
              return node.coords[1];
            });
          }) - 1;

        var maxY =
          d3.max(_data.raw, function (line) {
            return d3.max(line.nodes, function (node) {
              return node.coords[1];
            });
          }) + 1;

        var desiredAspectRatio = (maxX - minX) / (maxY - minY);
        var actualAspectRatio =
          (width - margin.left - margin.right) /
          (height - margin.top - margin.bottom);

        var ratioRatio = actualAspectRatio / desiredAspectRatio;
        var maxXRange;
        var maxYRange;

        // Note that we flip the sense of the y-axis here
        if (desiredAspectRatio > actualAspectRatio) {
          maxXRange = width - margin.left - margin.right;
          maxYRange = (height - margin.top - margin.bottom) * ratioRatio;
        } else {
          maxXRange = (width - margin.left - margin.right) / ratioRatio;
          maxYRange = height - margin.top - margin.bottom;
        }

        xScale.domain([minX, maxX]).range([margin.left, margin.left + maxXRange]);
        yScale.domain([minY, maxY]).range([margin.top + maxYRange, margin.top]);

        var unitLength = Math.abs(
          xScale(1) - xScale(0) !== 0
            ? xScale(1) - xScale(0)
            : yScale(1) - yScale(0)
        );

        lineWidth = lineWidthMultiplier * unitLength;

        svg = selection
          .append('svg')
          .style('width', '100%')
          .style('height', '100%');

        gMap = svg.append('g');

        if (_data.river !== undefined) {
          drawRiver();
        }

        drawLines();
        drawInterchanges();
        drawStations();
        drawLabels();
      });
    }

    map.width = function (w) {
      if (!arguments.length) return width;
      width = w;
      return map;
    };

    map.height = function (h) {
      if (!arguments.length) return height;
      height = h;
      return map;
    };

    map.margin = function (m) {
      if (!arguments.length) return margin;
      margin = m;
      return map;
    };

    map.on = function () {
      var value = listeners.on.apply(listeners, arguments);
      return value === listeners ? map : value;
    };

    function drawRiver() {
      gMap
        .append('g')
        .attr('class', 'river')
        .selectAll('path')
        .data([_data.river])
        .enter()
        .append('path')
        .attr('d', function (d) {
          return line(d, xScale, yScale, lineWidth, lineWidthTickRatio);
        })
        .attr('stroke', '#CCECF4')
        .attr('fill', 'none')
        .attr('stroke-width', 1.8 * lineWidth);
    }

    function drawLines() {
      gMap
        .append('g')
        .attr('class', 'lines')
        .selectAll('path')
        .data(_data.lines.lines)
        .enter()
        .append('path')
        .attr('d', function (d) {
          return line(d, xScale, yScale, lineWidth, lineWidthTickRatio);
        })
        .attr('id', function (d) {
          return d.name;
        })
        .attr('stroke', function (d) {
          return d.color;
        })
        .attr('fill', 'none')
        .attr('stroke-width', function (d) {
          return d.highlighted ? lineWidth * 1.3 : lineWidth;
        })
        .classed('line', true);
    }

    function drawInterchanges() {
      var fgColor = '#000000';
      var bgColor = '#ffffff';

      gMap
        .append('g')
        .attr('class', 'interchanges')
        .selectAll('path')
        .data(_data.stations.interchanges())
        .enter()
        .append('g')
        .attr('id', function (d) {
          return d.name;
        })
        .on('click', function () {
          var label = d3.select(this);
          var name = label.attr('id');
          listeners.call('click', this, name);
        })
        .append('path')
        .attr('d', interchange(lineWidth))
        .attr('transform', function (d) {
          let shiftNormal = interchangeShift(d.marker);
          return (
            'translate(' +
            xScale(
              d.x + (shiftNormal[0] + d.marker[0].shiftX) * lineWidthMultiplier
            ) +
            ',' +
            yScale(
              d.y + (shiftNormal[1] + d.marker[0].shiftY) * lineWidthMultiplier
            ) +
            ')'
          );
        })
        .attr('stroke-width', lineWidth / 2)
        .attr('fill', function (d) {
          return d.visited ? fgColor : bgColor;
        })
        .attr('stroke', function (d) {
          return d.visited ? bgColor : fgColor;
        })
        .classed('interchange', true)
        .style('cursor', 'pointer');
    }

    function drawStations() {
      gMap
        .append('g')
        .attr('class', 'stations')
        .selectAll('path')
        .data(_data.stations.normalStations())
        .enter()
        .append('g')
        .attr('id', function (d) {
          return d.name;
        })
        .on('click', function () {
          var label = d3.select(this);
          var name = label.attr('id');
          listeners.call('click', this, name);
        })
        .append('path')
        .attr('d', function (d) {
          return station(
            d,
            xScale,
            yScale,
            lineWidthMultiplier,
            lineWidthTickRatio
          );
        })
        .attr('stroke', function (d) {
          return d.color;
        })
        .attr('stroke-width', lineWidth / lineWidthTickRatio)
        .attr('fill', 'none')
        .attr('class', function (d) {
          return d.line;
        })
        .attr('id', function (d) {
          return d.name;
        })
        .classed('station', true);
    }

    function drawLabels() {
      gMap
        .append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(_data.stations.toArray())
        .enter()
        .append('g')
        .attr('id', function (d) {
          return d.name;
        })
        .classed('label', true)
        .on('click', function () {
          var label = d3.select(this);
          var name = label.attr('id');
          listeners.call('click', this, name);
        })
        .append('text')
        .text(function (d) {
          return d.label;
        })
        .attr('fill', '#10137E')
        .attr('dy', 0)
        .attr('x', function (d) {
          let shiftX =
            d.labelShiftX +
            d.labelShiftNormal * normalize(directionVector(d.dir))[1];
          return xScale(d.x + shiftX * lineWidthMultiplier) + textPos(d).pos[0];
        })
        .attr('y', function (d) {
          let shiftY =
            d.labelShiftY -
            d.labelShiftNormal * normalize(directionVector(d.dir))[0];
          return yScale(d.y + shiftY * lineWidthMultiplier) - textPos(d).pos[1];
        })
        .attr('text-anchor', function (d) {
          return textPos(d).textAnchor;
        })
        .style('display', function (d) {
          return d.hide !== true ? 'block' : 'none';
        })
        .style('text-decoration', function (d) {
          return d.closed ? 'line-through' : 'none';
        })
        .style('font-size', 1.96 * lineWidth + 'px')
        .style('-webkit-user-select', 'none')
        .attr('class', function (d) {
          return d.marker
            .map(function (marker) {
              return marker.line;
            })
            .join(' ');
        })
        .classed('highlighted', function (d) {
          return d.visited;
        })
        .call(wrap, function (d) {
          return textPos(d).alignmentBaseline;
        });
    }

    function transformData(data) {
      data.lines.forEach((line) => populateLineDirections(line));
      if (data.river !== undefined) {
        populateLineDirections(data.river);
      }

      return {
        raw: data.lines,
        river: data.river,
        stations: extractStations(data),
        lines: extractLines(data.lines),
      };
    }

    function extractStations(data) {
      data.lines.forEach(function (line) {
        for (var node = 0; node < line.nodes.length; node++) {
          var d = line.nodes[node];

          if (!d.hasOwnProperty('name')) continue;

          if (!data.stations.hasOwnProperty(d.name))
            throw new Error('Cannot find station with key: ' + d.name);

          var station = data.stations[d.name];

          station.x = d.coords[0];
          station.y = d.coords[1];

          if (station.labelPos === undefined || d.hasOwnProperty('canonical')) {
            station.labelPos = d.labelPos;
            station.labelShiftX = d.hasOwnProperty('labelShiftCoords')
              ? d.labelShiftCoords[0]
              : d.hasOwnProperty('shiftCoords')
              ? d.shiftCoords[0]
              : line.shiftCoords[0];
            station.labelShiftY = d.hasOwnProperty('labelShiftCoords')
              ? d.labelShiftCoords[1]
              : d.hasOwnProperty('shiftCoords')
              ? d.shiftCoords[1]
              : line.shiftCoords[1];
            station.labelShiftNormal = line.hasOwnProperty('shiftNormal')
              ? line.shiftNormal
              : 0;
            station.dir = d.dir;
          }

          station.label = data.stations[d.name].label;
          station.position = data.stations[d.name].position;
          station.closed = data.stations[d.name].hasOwnProperty('closed')
            ? data.stations[d.name].closed
            : false;
          station.visited = false;

          if (!d.hide) {
            station.marker = station.marker || [];

            station.marker.push({
              line: line.name,
              color: line.color,
              labelPos: d.labelPos,
              dir: d.dir,
              marker: d.hasOwnProperty('marker') ? d.marker : 'station',
              shiftX: d.hasOwnProperty('shiftCoords')
                ? d.shiftCoords[0]
                : line.shiftCoords[0],
              shiftY: d.hasOwnProperty('shiftCoords')
                ? d.shiftCoords[1]
                : line.shiftCoords[1],
              shiftNormal: line.hasOwnProperty('shiftNormal')
                ? line.shiftNormal
                : 0,
            });
          }
        }
      });

      return stationList(data.stations);
    }

    function extractLines(data) {
      var lines = [];

      data.forEach(function (line) {
        var lineObj = {
          name: line.name,
          title: line.label,
          stations: [],
          color: line.color,
          shiftCoords: line.shiftCoords,
          shiftNormal: line.shiftNormal,
          nodes: line.nodes,
          highlighted: false,
        };

        lines.push(lineObj);

        for (var node = 0; node < line.nodes.length; node++) {
          var data = line.nodes[node];

          if (!data.hasOwnProperty('name')) continue;

          lineObj.stations.push(data.name);
        }
      });

      return lineList(lines);
    }

    function textPos(data) {
      var pos;
      var textAnchor;
      var alignmentBaseline;
      var offset = lineWidth * 1.8;

      var numLines = data.label.split(/\n/).length;

      var sqrt2 = Math.sqrt(2);

      switch (data.labelPos.toLowerCase()) {
        case 'n':
          pos = [0, 2.1 * lineWidth * (numLines - 1) + offset];
          textAnchor = 'middle';
          alignmentBaseline = 'baseline';
          break;
        case 'ne':
          pos = [offset / sqrt2, (lineWidth * (numLines - 1) + offset) / sqrt2];
          textAnchor = 'start';
          alignmentBaseline = 'baseline';
          break;
        case 'e':
          pos = [offset, 0];
          textAnchor = 'start';
          alignmentBaseline = 'middle';
          break;
        case 'se':
          pos = [offset / sqrt2, -offset / sqrt2];
          textAnchor = 'start';
          alignmentBaseline = 'hanging';
          break;
        case 's':
          pos = [0, -lineWidthMultiplier * offset];
          textAnchor = 'middle';
          alignmentBaseline = 'hanging';
          break;
        case 'sw':
          pos = [-offset / sqrt2, -offset / sqrt2];
          textAnchor = 'end';
          alignmentBaseline = 'hanging';
          break;
        case 'w':
          pos = [-offset, 0];
          textAnchor = 'end';
          alignmentBaseline = 'middle';
          break;
        case 'nw':
          pos = [
            -(lineWidth * (numLines - 1) + offset) / sqrt2,
            (lineWidth * (numLines - 1) + offset) / sqrt2,
          ];
          textAnchor = 'end';
          alignmentBaseline = 'baseline';
          break;
      }

      return {
        pos: pos,
        textAnchor: textAnchor,
        alignmentBaseline: alignmentBaseline,
      };
    }

    // Render line breaks for svg text
    function wrap(text, baseline) {
      text.each(function () {
        var text = d3.select(this);
        var lines = text.text().split(/\n/);

        var y = text.attr('y');
        var x = text.attr('x');
        var dy = parseFloat(text.attr('dy'));

        text
          .text(null)
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', dy + 'em')
          .attr('dominant-baseline', baseline)
          .text(lines[0]);

        for (var lineNum = 1; lineNum < lines.length; lineNum++) {
          text
            .append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dy', lineNum * 1.1 + dy + 'em')
            .attr('dominant-baseline', baseline)
            .text(lines[lineNum]);
        }
      });
    }

    return map;
  }

  exports.tubeMap = map;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
