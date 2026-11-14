/*
 * SVG handwriting recovery helpers.
 *
 * The portable snapshot exporter writes filled outlines rather than the
 * original Pencil samples. This module turns those outlines into a stable,
 * editable geometry record and provides the metadata envelope used by future
 * snapshots. It deliberately accepts only the small SVG path vocabulary that
 * the exporter emits.
 */
var HandwritingSvgRecovery = (() => {
  const FORMAT_VERSION = 1;
  const EPSILON = 1e-6;

  const finite = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`SVG recovery geometry must be finite (${label})`);
    return number;
  };

  const clonePoint = point => ({ x: finite(point.x, "x"), y: finite(point.y, "y") });
  const clonePoints = points => (Array.isArray(points) ? points : []).map(clonePoint);
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const average = values => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

  const boundsOf = (points, padding = 0) => {
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  };

  const canonicalCaps = caps => (Array.isArray(caps) ? caps : []).map(cap => ({
    x: finite(cap.x, "cap.x"),
    y: finite(cap.y, "cap.y"),
    r: Math.max(0.05, finite(cap.r, "cap.r")),
  }));

  const canonicalSubpaths = subpaths => (Array.isArray(subpaths) ? subpaths : []).map(subpath => {
    if (subpath.kind === "circle") {
      return { kind: "circle", center: clonePoint(subpath.center), r: Math.max(0.05, finite(subpath.r, "circle.r")) };
    }
    const points = clonePoints(subpath.points);
    if (points.length < 2) throw new Error("SVG recovery polygon has too few points");
    return { kind: "polygon", points };
  });

  const subpathsPoints = subpaths => subpaths.flatMap(subpath => subpath.kind === "circle"
    ? [{ ...subpath.center, x: subpath.center.x - subpath.r, y: subpath.center.y - subpath.r },
      { ...subpath.center, x: subpath.center.x + subpath.r, y: subpath.center.y + subpath.r }]
    : subpath.points);

  const pathForSubpaths = subpaths => subpaths.map(subpath => {
    if (subpath.kind === "circle") {
      const { x, y } = subpath.center;
      const r = subpath.r;
      return `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
    }
    return `M ${subpath.points.map(point => `${point.x} ${point.y}`).join(" L ")} Z`;
  }).join(" ");

  const recoveredGeometry = (subpaths, outline, caps, centers, halfWidths, sourcePath = "") => {
    const canonical = canonicalSubpaths(subpaths);
    const canonicalOutline = clonePoints(outline);
    const canonicalCapsValue = canonicalCaps(caps);
    const canonicalCenters = clonePoints(centers);
    const canonicalWidths = (Array.isArray(halfWidths) ? halfWidths : []).map(value => Math.max(0.05, finite(value, "halfWidth")));
    if (canonicalCenters.length !== canonicalWidths.length) throw new Error("SVG recovery centre and width counts differ");
    const geometryPoints = subpathsPoints(canonical);
    const padding = canonicalWidths.length ? Math.max(...canonicalWidths) : 0;
    return {
      version: FORMAT_VERSION,
      subpaths: canonical,
      outline: canonicalOutline,
      caps: canonicalCapsValue,
      centers: canonicalCenters,
      halfWidths: canonicalWidths,
      sourcePath: typeof sourcePath === "string" ? sourcePath : "",
      bbox: boundsOf([...geometryPoints, ...canonicalCapsValue.flatMap(cap => [
        { x: cap.x - cap.r, y: cap.y - cap.r },
        { x: cap.x + cap.r, y: cap.y + cap.r },
      ])], padding * 0),
    };
  };

  const strokeFromOutline = ({ id, tool = "pen", color = "#000000", width, outline = [], caps = [], subpaths, sourcePath = "" }) => {
    const inputOutline = clonePoints(outline);
    let centres = [];
    let widths = [];
    if (inputOutline.length >= 4 && inputOutline.length % 2 === 0) {
      const sideLength = inputOutline.length / 2;
      const left = inputOutline.slice(0, sideLength);
      const right = inputOutline.slice(sideLength).reverse();
      for (let index = 0; index < sideLength; index++) {
        const centre = midpoint(left[index], right[index]);
        const halfWidth = Math.max(0.05, distance(left[index], right[index]) / 2);
        centres.push(centre);
        widths.push(halfWidth);
      }
    } else if (inputOutline.length > 0) {
      throw new Error("SVG recovery outline must contain paired sides");
    }
    if (centres.length === 0 && caps.length > 0) {
      const first = canonicalCaps(caps)[0];
      centres = [{ x: first.x, y: first.y }];
      widths = [first.r];
    }
    if (centres.length === 0) throw new Error("SVG recovery geometry has no editable centreline");
    const canonicalCapsValue = canonicalCaps(caps);
    const canonicalSubpathsValue = subpaths ?? [
      ...(inputOutline.length ? [{ kind: "polygon", points: inputOutline }] : []),
      ...canonicalCapsValue.map(cap => ({ kind: "circle", center: { x: cap.x, y: cap.y }, r: cap.r })),
    ];
    const geometry = recoveredGeometry(canonicalSubpathsValue, inputOutline, canonicalCapsValue, centres, widths, sourcePath);
    const baseWidth = Number.isFinite(Number(width)) && Number(width) > 0 ? Number(width) : average(widths) * 2;
    const points = centres.map((point, index) => ({ x: point.x, y: point.y, pressure: 0.5, t: index * 16 }));
    return {
      id: String(id || `recovered-${Math.random().toString(36).slice(2)}`),
      tool: tool === "highlighter" ? "highlighter" : "pen",
      color: String(color || "#000000"),
      width: Math.max(0.05, baseWidth),
      widthMode: "recovered",
      points,
      recoveredGeometry: geometry,
      bbox: geometry.bbox,
      createdAt: Date.now(),
    };
  };

  const tokenizePath = path => String(path || "").match(/[MLAZmlaz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];

  const parsePathSubpaths = path => {
    const tokens = tokenizePath(path);
    const subpaths = [];
    let index = 0;
    let current = { x: 0, y: 0 };
    let active = null;
    let command = "";
    const finish = () => {
      if (active) subpaths.push(active);
      active = null;
    };
    const number = label => finite(tokens[index++], label);
    while (index < tokens.length) {
      if (/^[MLAZmlaz]$/.test(tokens[index])) command = tokens[index++];
      if (!command) throw new Error("SVG recovery path starts without a command");
      const relative = command === command.toLowerCase();
      const upper = command.toUpperCase();
      if (upper === "M") {
        const x = number("path.x"), y = number("path.y");
        current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
        finish();
        active = { kind: "path", points: [current], arcs: [] };
        command = relative ? "l" : "L";
      } else if (upper === "L") {
        const x = number("path.x"), y = number("path.y");
        current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
        if (!active) throw new Error("SVG recovery line has no active subpath");
        active.points.push(current);
      } else if (upper === "A") {
        const rx = Math.abs(number("arc.rx"));
        const ry = Math.abs(number("arc.ry"));
        number("arc.rotation");
        number("arc.largeArc");
        number("arc.sweep");
        const x = number("arc.x"), y = number("arc.y");
        const start = current;
        current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
        if (!active) throw new Error("SVG recovery arc has no active subpath");
        active.arcs.push({ start, end: current, rx, ry });
      } else if (upper === "Z") {
        finish();
        command = "";
      } else {
        throw new Error(`SVG recovery path command ${command} is unsupported`);
      }
    }
    finish();
    return subpaths.map(subpath => {
      if (subpath.arcs.length > 0) {
        if (subpath.arcs.length < 2) throw new Error("SVG recovery circle is incomplete");
        const first = subpath.arcs[0];
        const center = midpoint(first.start, first.end);
        const radius = Math.max(first.rx, first.ry, distance(first.start, first.end) / 2);
        return { kind: "circle", center, r: radius };
      }
      return { kind: "polygon", points: subpath.points };
    });
  };

  const attribute = (tag, name) => {
    const expression = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
    return expression.exec(tag)?.[2] ?? null;
  };

  const translateForInk = svg => {
    const start = String(svg || "").indexOf("</foreignObject>");
    const tail = start >= 0 ? String(svg || "").slice(start) : String(svg || "");
    const match = /<g\b[^>]*\btransform\s*=\s*(["'])translate\(\s*([-+]?\d*\.?\d+)\s*(?:,|\s)\s*([-+]?\d*\.?\d+)\s*\)\1/i.exec(tail);
    return { tail, x: match ? finite(match[2], "transform.x") : 0, y: match ? finite(match[3], "transform.y") : 0 };
  };

  const isHighlighterPath = (tail, offset) => {
    const ranges = [];
    const expression = /<g\b[^>]*\bopacity\s*=\s*(["'])[^"']+\1[^>]*>([\s\S]*?)<\/g>/gi;
    for (const match of tail.matchAll(expression)) {
      const contentStart = match.index + match[0].indexOf(">") + 1;
      ranges.push([contentStart, contentStart + match[2].length]);
    }
    return ranges.some(([start, end]) => offset >= start && offset < end);
  };

  const shiftSubpaths = (subpaths, dx, dy) => subpaths.map(subpath => subpath.kind === "circle"
    ? { kind: "circle", center: { x: subpath.center.x - dx, y: subpath.center.y - dy }, r: subpath.r }
    : { kind: "polygon", points: subpath.points.map(point => ({ x: point.x - dx, y: point.y - dy })) });

  const extractSvgStrokes = svg => {
    const { tail, x: offsetX, y: offsetY } = translateForInk(svg);
    const strokes = [];
    const pathExpression = /<path\b[^>]*>/gi;
    for (const match of tail.matchAll(pathExpression)) {
      const tag = match[0];
      const path = attribute(tag, "d");
      if (!path) continue;
      const fill = attribute(tag, "fill") || "#000000";
      const subpaths = shiftSubpaths(parsePathSubpaths(path), offsetX, offsetY);
      let current = null;
      const flush = () => {
        if (!current) return;
        strokes.push(strokeFromOutline({
          id: `svg-recovered-${strokes.length + 1}`,
          tool: isHighlighterPath(tail, match.index) ? "highlighter" : "pen",
          color: fill,
          outline: current.outline,
          caps: current.caps,
          subpaths: current.subpaths,
          sourcePath: path,
        }));
        current = null;
      };
      for (const subpath of subpaths) {
        if (subpath.kind === "polygon" && subpath.points.length >= 4) {
          flush();
          current = { outline: subpath.points, caps: [], subpaths: [subpath] };
        } else if (subpath.kind === "circle") {
          if (current) {
            current.caps.push({ ...subpath.center, r: subpath.r });
            current.subpaths.push(subpath);
          } else {
            strokes.push(strokeFromOutline({
              id: `svg-recovered-${strokes.length + 1}`,
              tool: isHighlighterPath(tail, match.index) ? "highlighter" : "pen",
              color: fill,
              caps: [{ ...subpath.center, r: subpath.r }],
              subpaths: [subpath],
              sourcePath: path,
            }));
          }
        }
      }
      flush();
    }
    if (strokes.length === 0) throw new Error("SVG contains no supported handwriting geometry");
    return strokes;
  };

  const escapeXml = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;",
  }[character]));
  const unescapeXml = value => String(value)
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  const encodeMetadata = payload => {
    const data = payload && typeof payload === "object" ? payload : {};
    return JSON.stringify({
      format: "handwriting-svg-recovery",
      version: FORMAT_VERSION,
      ...data,
    });
  };

  const decodeMetadata = encoded => {
    let data;
    try { data = JSON.parse(String(encoded || "")); } catch { throw new Error("Handwriting recovery metadata is not valid JSON"); }
    if (!data || data.format !== "handwriting-svg-recovery" || data.version !== FORMAT_VERSION || !Array.isArray(data.strokes)) {
      throw new Error("Handwriting recovery metadata version is unsupported");
    }
    return data;
  };

  const metadataElement = payload => `<handwriting-recovery data-format="${FORMAT_VERSION}">${escapeXml(encodeMetadata(payload))}</handwriting-recovery>`;

  const extractMetadata = svg => {
    const match = /<handwriting-recovery\b[^>]*>([\s\S]*?)<\/handwriting-recovery>/i.exec(String(svg || ""));
    if (!match) throw new Error("SVG does not contain handwriting recovery data");
    return decodeMetadata(unescapeXml(match[1]));
  };

  const pathFromRecoveredGeometry = geometry => pathForSubpaths(canonicalSubpaths(geometry?.subpaths));

  const translateGeometry = (geometry, dx, dy) => transformGeometry(geometry, point => ({ x: point.x + dx, y: point.y + dy }), radius => radius);
  const scaleGeometry = (geometry, anchor, scale) => transformGeometry(
    geometry,
    point => ({ x: anchor.x + (point.x - anchor.x) * scale, y: anchor.y + (point.y - anchor.y) * scale }),
    radius => Math.max(0.05, radius * Math.abs(scale)),
  );
  const transformGeometry = (geometry, mapPoint, mapRadius) => {
    const source = geometry || {};
    const subpaths = canonicalSubpaths(source.subpaths).map(subpath => subpath.kind === "circle"
      ? { kind: "circle", center: mapPoint(subpath.center), r: mapRadius(subpath.r) }
      : { kind: "polygon", points: subpath.points.map(mapPoint) });
    const centers = clonePoints(source.centers).map(mapPoint);
    const halfWidths = (source.halfWidths || []).map(mapRadius);
    const outline = clonePoints(source.outline).map(mapPoint);
    const caps = canonicalCaps(source.caps).map(cap => ({ ...mapPoint(cap), r: mapRadius(cap.r) }));
    return recoveredGeometry(subpaths, outline, caps, centers, halfWidths, source.sourcePath);
  };

  const scaleGeometryWidths = (geometry, scale) => transformGeometry(geometry, point => ({ ...point }), radius => Math.max(0.05, radius * Math.abs(scale)));

  const isValidGeometry = geometry => {
    try {
      if (!geometry || geometry.version !== FORMAT_VERSION) return false;
      const subpaths = canonicalSubpaths(geometry.subpaths);
      const centers = clonePoints(geometry.centers);
      const widths = (Array.isArray(geometry.halfWidths) ? geometry.halfWidths : []).map(value => Math.max(0.05, finite(value, "halfWidth")));
      return subpaths.length > 0 && centers.length > 0 && centers.length === widths.length;
    } catch {
      return false;
    }
  };

  const pointSegmentDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON) return distance(point, start);
    const share = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + dx * share), point.y - (start.y + dy * share));
  };

  const strokeFromCenters = (source, centers, halfWidths, id) => {
    if (centers.length === 1) {
      return strokeFromOutline({
        id,
        tool: source.tool,
        color: source.color,
        width: source.width,
        caps: [{ ...centers[0], r: halfWidths[0] }],
        subpaths: [{ kind: "circle", center: { ...centers[0] }, r: halfWidths[0] }],
        sourcePath: source.recoveredGeometry?.sourcePath || "",
      });
    }
    const left = [], right = [];
    for (let index = 0; index < centers.length; index++) {
      const before = centers[Math.max(0, index - 1)];
      const after = centers[Math.min(centers.length - 1, index + 1)];
      let dx = after.x - before.x, dy = after.y - before.y;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length; dy /= length;
      const nx = -dy * halfWidths[index], ny = dx * halfWidths[index];
      left.push({ x: centers[index].x + nx, y: centers[index].y + ny });
      right.push({ x: centers[index].x - nx, y: centers[index].y - ny });
    }
    const outline = [...left, ...right.reverse()];
    const caps = [
      { ...centers[0], r: halfWidths[0] },
      { ...centers.at(-1), r: halfWidths.at(-1) },
    ];
    return strokeFromOutline({
      id,
      tool: source.tool,
      color: source.color,
      width: average(halfWidths) * 2,
      outline,
      caps,
      subpaths: [
        { kind: "polygon", points: outline },
        ...caps.map(cap => ({ kind: "circle", center: { x: cap.x, y: cap.y }, r: cap.r })),
      ],
      sourcePath: source.recoveredGeometry?.sourcePath || "",
    });
  };

  const splitRecoveredStroke = (stroke, x, y, radius, idFactory = id => `${id}-part`) => {
    const geometry = stroke?.recoveredGeometry;
    if (!geometry?.centers?.length) return [stroke];
    const eraser = { x: finite(x, "eraser.x"), y: finite(y, "eraser.y") };
    const eraserRadius = Math.max(0, finite(radius, "eraser.radius"));
    const centers = clonePoints(geometry.centers);
    const halfWidths = geometry.halfWidths.map(value => Math.max(0.05, finite(value, "halfWidth")));
    const touched = centers.map((center, index) => Math.hypot(center.x - eraser.x, center.y - eraser.y) <= eraserRadius + halfWidths[index]);
    for (let index = 0; index < centers.length - 1; index++) {
      if (!touched[index] && !touched[index + 1] && pointSegmentDistance(eraser, centers[index], centers[index + 1]) <= eraserRadius + Math.max(halfWidths[index], halfWidths[index + 1])) {
        touched[index] = true;
        touched[index + 1] = true;
      }
    }
    if (!touched.some(Boolean)) return [stroke];
    const pieces = [];
    let currentCenters = [], currentWidths = [];
    const flush = () => {
      if (currentCenters.length > 0) {
        const id = idFactory(stroke.id, pieces.length);
        pieces.push(strokeFromCenters(stroke, currentCenters, currentWidths, id));
        currentCenters = [];
        currentWidths = [];
      }
    };
    for (let index = 0; index < centers.length; index++) {
      if (touched[index]) flush();
      else {
        currentCenters.push(centers[index]);
        currentWidths.push(halfWidths[index]);
      }
    }
    flush();
    return pieces;
  };

  return {
    FORMAT_VERSION,
    boundsOf,
    strokeFromOutline,
    parsePathSubpaths,
    extractSvgStrokes,
    pathFromRecoveredGeometry,
    translateGeometry,
    scaleGeometry,
    scaleGeometryWidths,
    isValidGeometry,
    splitRecoveredStroke,
    encodeMetadata,
    decodeMetadata,
    metadataElement,
    extractMetadata,
  };
})();
