// This library is a part of bezier.js by Pomax ( MIT license ). https://pomax.github.io/bezierjs/
// The library has been modified to meet ES3 standard to be used with Toon Boom Harmony.

/**
	A javascript Bezier curve library by Pomax.
	
	Based on http://pomax.github.io/bezierinfo
	
	This code is MIT licensed.
**/
function bezier_lib()
{
	// math-inlining.
	var abs = Math.abs;
	var min = Math.min;
	var max = Math.max;
	var cos = Math.cos;
	var sin = Math.sin;
	var acos = Math.acos;
	var sqrt = Math.sqrt;
	var pi = Math.PI;
    // a zero coordinate, which is surprisingly useful
    var ZERO = { x: 0, y: 0, z: 0 };
	
	// quite needed
	var utilsJs = require("./utils.js"); 
	var UT = new utilsJs.utils_lib;
	
	
   /*
	* Bezier curve constructor. The constructor argument can be one of three things:
	*
	* 1. array/4 of {x:..., y:..., z:...}, z optional
	* 2. numerical array/8 ordered x1,y1,x2,y2,x3,y3,x4,y4
	* 3. numerical array/12 ordered x1,y1,z1,x2,y2,z2,x3,y3,z3,x4,y4,z4
	*
	*/
	this.Bezier = function(coords)
	{
		var args = coords && coords.forEach ? coords : [].slice.call(arguments);
		var coordlen = false;
		if (typeof args[0] === "object")
		{
			coordlen = args.length;
			var newargs = [];
			args.forEach(function(point)
				{
					["x", "y", "z"].forEach(function(d)
						{
							if (typeof point[d] !== "undefined")
							newargs.push(point[d]);
						});
				});
				args = newargs;
		}
		
		var higher = false;
		var len = args.length;
		if (coordlen)
		{
			if (coordlen > 4)
			{
				if (arguments.length !== 1)
					MessageLog.trace( "Only new Bezier(point[]) is accepted for 4th and higher order curves" );
				
				higher = true;
			}
		}
		else
		{
			if (len !== 6 && len !== 8 && len !== 9 && len !== 12)
			{
				if (arguments.length !== 1)
					MessageLog.trace( "Only new Bezier(point[]) is accepted for 4th and higher order curves");
			}
		}
		
		var _3d = (!higher && (len === 9 || len === 12)) || (coords && coords[0] && typeof coords[0].z !== "undefined");
		this._3d = _3d;
		
		var points = [];
		for (var idx = 0, step = _3d ? 3 : 2; idx < len; idx += step)
		{
			var point = { x: args[idx], y: args[idx + 1] };
			if (_3d)
				point.z = args[idx + 2];
			
			points.push(point);
		}
		
		this.order = points.length - 1;
		this.points = points;
		var dims = ["x", "y"];
		if (_3d)
		dims.push("z");
		
		this.dims = dims;
		this.dimlen = dims.length;
		
		(
			function(curve)
			{
				var order = curve.order;
				var points = curve.points;
				var a = UT.utils.align(points, { p1: points[0], p2: points[order] });
				
				for (var i = 0; i < a.length; i++)
				{
					if (abs(a[i].y) > 0.0001)
					{
						curve._linear = false;
						return;
					}
				}
				
				curve._linear = true;
			}
		)(this);
		
		this._t1 = 0;
		this._t2 = 1;
		this.update();
	}
	
	
	function getABC(n, S, B, E, t)
	{
		if (typeof t === "undefined")
			t = 0.5;
		
		var u = UT.utils.projectionratio(t, n);
		var um = 1 - u;
		
		var C = {
			x: u * S.x + um * E.x,
			y: u * S.y + um * E.y
		};
		
		var s = UT.utils.abcratio(t, n);
		
		var A = {
			x: B.x + (B.x - C.x) / s,
			y: B.y + (B.y - C.y) / s
		};
		
		return { A: A, B: B, C: C };
	}
	
	
	this.Bezier.quadraticFromPoints = function(p1, p2, p3, t)
	{
		if (typeof t === "undefined")
			t = 0.5;
		
		// shortcuts, although they're really dumb
		if (t === 0)
			return new this.Bezier(p2, p2, p3);
		
		if (t === 1)
			return new this.Bezier(p1, p2, p2);
		
		// real fitting.
		var abc = getABC(2, p1, p2, p3, t);
		return new this.Bezier(p1, abc.A, p3);
	}
	
	
	this.Bezier.cubicFromPoints = function(S, B, E, t, d1)
	{
		if (typeof t === "undefined")
			t = 0.5;
		
		var abc = getABC(3, S, B, E, t);
		
		if (typeof d1 === "undefined")
			d1 = UT.utils.dist(B, abc.C);
		
		var d2 = d1 * (1 - t) / t;
		
		var selen = UT.utils.dist(S, E);
		var lx = (E.x - S.x) / selen;
		var ly = (E.y - S.y) / selen;
		var bx1 = d1 * lx;
		var by1 = d1 * ly;
		var bx2 = d2 * lx;
		var by2 = d2 * ly;
		
		// derivation of new hull coordinates
		var e1 = { x: B.x - bx1, y: B.y - by1 };
		var e2 = { x: B.x + bx2, y: B.y + by2 };
		var A = abc.A;
		var v1 = { x: A.x + (e1.x - A.x) / (1 - t), y: A.y + (e1.y - A.y) / (1 - t) };
		var v2 = { x: A.x + (e2.x - A.x) / t, y: A.y + (e2.y - A.y) / t };
		var nc1 = { x: S.x + (v1.x - S.x) / t, y: S.y + (v1.y - S.y) / t };
		var nc2 = {
			x: E.x + (v2.x - E.x) / (1 - t),
			y: E.y + (v2.y - E.y) / (1 - t)
		};
		// ...done
		
		return new this.Bezier(S, nc1, nc2, E);
	}
	
	var getUtils = function()
	{
		return UT.utils;
	}
	
	this.Bezier.getUtils = getUtils;
	
	
	
	
	this.Bezier.prototype =
	{			
		getUtils: getUtils,
		
		valueOf: function()
		{
			return this.toString();
		},
		
		toString: function()
		{
			return UT.utils.pointsToString(this.points);
		},
		
		toSVG: function(relative)
		{
			if (this._3d)
				return false;
			
			var p = this.points;
			var x = p[0].x;
			var y = p[0].y;
			var s = ["M", x, y, this.order === 2 ? "Q" : "C"];
			
			for (var i = 1, last = p.length; i < last; i++)
			{
				s.push(p[i].x);
				s.push(p[i].y);
			}
			return s.join(" ");
		},
		
		setRatios: function(ratios)
		{
			if (ratios.length !== this.points.length)
				MessageLog.trace( "incorrect number of ratio values");

			this.ratios = ratios;
			this._lut = []; //  invalidate any precomputed LUT
		},
		
		verify: function()
		{
			var print = this.coordDigest();
			if (print !== this._print)
			{
				this._print = print;
				this.update();
			}
		},
		
		coordDigest: function()
		{
			return this.points.map(function(c,pos)
			{
				return '' + pos + c.x + c.y + (c.z?c.z:0);
			}).join('');
		},
		
		update: function(newprint)
		{
			// invalidate any precomputed LUT
			this._lut = [];
			this.dpoints = UT.utils.derive(this.points, this._3d);
			this.computedirection();
		},
		
		computedirection: function()
		{
			var points = this.points;
			var angle = UT.utils.angle(points[0], points[this.order], points[1]);
			this.clockwise = angle > 0;
		},
		
		length: function()
		{
			return UT.utils.length( this );
		},
		
		_lut: [],
		
		getLUT: function(steps)
		{
			this.verify();
			steps = steps || 100;
			
			if (this._lut.length === steps)
				return this._lut;

			this._lut = [];
			// We want a range from 0 to 1 inclusive, so
			// we decrement and then use <= rather than <:
			steps--;
			
			for (var t = 0; t <= steps; t++)
			{
				this._lut.push(this.compute(t / steps));
			}
			
			return this._lut;
		},
		
		on: function(point, error)
		{
			error = error || 5;
			var lut = this.getLUT();
			var hits = [];
			var c;
			var t = 0;
			
			for (var i = 0; i < lut.length; i++)
			{
				c = lut[i];
				if (UT.utils.dist(c, point) < error)
				{
					hits.push(c);
					t += i / lut.length;
				}
			}
			
			if (!hits.length)
				return false;
			
			return (t /= hits.length);
		},
		
		project: function(point)
		{
			// step 1: coarse check
			var LUT = this.getLUT();
			var l = LUT.length - 1;
			var closest = UT.utils.closest(LUT, point);
			var mdist = closest.mdist;
			var mpos = closest.mpos;
			
			// step 2: fine check
			var ft, t, p, d;
			var t1 = (mpos - 1) / l;
			var t2 = (mpos + 1) / l;
			var step = 0.1 / l;
			mdist += 1;

			for (t = t1, ft = t; t < t2 + step; t += step)
			{
				p = this.compute(t);
				d = UT.utils.dist(point, p);
				
				if (d < mdist)
				{
					mdist = d;
					ft = t;
				}
			}
			
			p = this.compute(ft);
			p.t = ft;
			p.d = mdist;
			
			return p;
		},
		
		get: function(t)
		{
			return this.compute(t);
		},
		
		point: function(idx)
		{
			return this.points[idx];
		},
		
		compute: function(t)
		{
			if (this.ratios)
				return UT.utils.computeWithRatios(t, this.points, this.ratios, this._3d);
			
			return UT.utils.compute(t, this.points, this._3d, this.ratios);
		},
		
		raise: function()
		{
			var p = this.points;
			var np = [p[0]];
			var i;
			var k = p.length;
			var pi;
			var pim;
			
			for (var i = 1; i < k; i++)
			{
				pi = p[i];
				pim = p[i - 1];
				np[i] = {
					x: (k - i) / k * pi.x + i / k * pim.x,
					y: (k - i) / k * pi.y + i / k * pim.y
				};
			}
			np[k] = p[k - 1];
			
			return new this.Bezier(np);
		},
		
		derivative: function(t)
		{
			var mt = 1 - t;
			var a, b;
			var c = 0;
			var p = this.dpoints[0];
			
			if (this.order === 2)
			{
				p = [p[0], p[1], ZERO];
				a = mt;
				b = t;
			}
			if (this.order === 3)
			{
				a = mt * mt;
				b = mt * t * 2;
				c = t * t;
			}
			var ret = {
				x: a * p[0].x + b * p[1].x + c * p[2].x,
				y: a * p[0].y + b * p[1].y + c * p[2].y
			};
			
			if (this._3d)
				ret.z = a * p[0].z + b * p[1].z + c * p[2].z;

			return ret;
		},
		
		curvature: function(t)
		{
			return UT.utils.curvature(t, this.points, this._3d);
		},
		
		inflections: function()
		{
			return UT.utils.inflections(this.points);
		},
		
		normal: function(t)
		{
			return this._3d ? this.__normal3(t) : this.__normal2(t);
		},
		
		__normal2: function(t)
		{
			var d = this.derivative(t);
			var q = sqrt(d.x * d.x + d.y * d.y);
			return { x: -d.y / q, y: d.x / q };
		},
		
		__normal3: function(t)
		{
			// see http://stackoverflow.com/questions/25453159
			var r1 = this.derivative(t);
			var r2 = this.derivative(t + 0.01);
			var q1 = sqrt(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z);
			var q2 = sqrt(r2.x * r2.x + r2.y * r2.y + r2.z * r2.z);
			r1.x /= q1;
			r1.y /= q1;
			r1.z /= q1;
			r2.x /= q2;
			r2.y /= q2;
			r2.z /= q2;
			
			// cross product
			var c = {
				x: r2.y * r1.z - r2.z * r1.y,
				y: r2.z * r1.x - r2.x * r1.z,
				z: r2.x * r1.y - r2.y * r1.x
			};
			
			var m = sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
			c.x /= m;
			c.y /= m;
			c.z /= m;
			
			// rotation matrix
			var R = [
				c.x * c.x,
				c.x * c.y - c.z,
				c.x * c.z + c.y,
				c.x * c.y + c.z,
				c.y * c.y,
				c.y * c.z - c.x,
				c.x * c.z - c.y,
				c.y * c.z + c.x,
				c.z * c.z
			];
			
			// normal vector:
			var n = {
				x: R[0] * r1.x + R[1] * r1.y + R[2] * r1.z,
				y: R[3] * r1.x + R[4] * r1.y + R[5] * r1.z,
				z: R[6] * r1.x + R[7] * r1.y + R[8] * r1.z
			};
			
			return n;
		},
		
		hull: function(t)
		{
			var p = this.points;
			var _p = [];
			var pt;
			var idx = 0;
			var i = 0;
			var l = 0;
			
			var q = [];			
			q[idx++] = p[0];
			q[idx++] = p[1];
			q[idx++] = p[2];
			
			if (this.order === 3)
				q[idx++] = p[3];
			
			// we lerp between all points at each iteration, until we have 1 point left.
			while (p.length > 1)
			{
				_p = [];
				for (i = 0, l = p.length - 1; i < l; i++)
				{
					pt = UT.utils.lerp(t, p[i], p[i + 1]);
					q[idx++] = pt;
					_p.push(pt);
				}
				p = _p;
			}
			
			return q;
		},
		
		split: function(t1, t2)
		{
			// shortcuts
			if (t1 === 0 && !!t2)
				return this.split(t2).left;

			if (t2 === 1)
				return this.split(t1).right;
			
			// no shortcut: use "de Casteljau" iteration.
			var q = this.hull(t1);
			var result = {
				left:
				this.order === 2
				? new this.Bezier([q[0], q[3], q[5]])
				: new this.Bezier([q[0], q[4], q[7], q[9]]),
				
				right:
				this.order === 2
				? new this.Bezier([q[5], q[4], q[2]])
				: new this.Bezier([q[9], q[8], q[6], q[3]]),
				
				span: q
			};
			
			// make sure we bind _t1/_t2 information!
			result.left._t1 = UT.utils.map(0, 0, 1, this._t1, this._t2);
			result.left._t2 = UT.utils.map(t1, 0, 1, this._t1, this._t2);
			result.right._t1 = UT.utils.map(t1, 0, 1, this._t1, this._t2);
			result.right._t2 = UT.utils.map(1, 0, 1, this._t1, this._t2);
			
			// if we have no t2, we're done
			if (!t2)
				return result;
			
			// if we have a t2, split again:
			t2 = UT.utils.map(t2, t1, 1, 0, 1);
			var subsplit = result.right.split(t2);
			return subsplit.left;
		},
		
		extrema: function()
		{
			var dims = this.dims;
			var result = {};
			var roots = [];
			var p;
			var mfn;
			
			dims.forEach(
				function(dim)
				{
					mfn = function(v)
					{
						return v[dim];
					};
					
					p = this.dpoints[0].map(mfn);
					result[dim] = UT.utils.droots(p);
					if (this.order === 3)
					{
						p = this.dpoints[1].map(mfn);
						result[dim] = result[dim].concat(UT.utils.droots(p));
					}
					
					result[dim] = result[dim].filter(function(t)
					{
						return t >= 0 && t <= 1;
					});
					
					roots = roots.concat(result[dim].sort(UT.utils.numberSort));
					
				}.bind(this)
			);
			
			roots = roots.sort(UT.utils.numberSort).filter(function(v, idx)
			{
				return roots.indexOf(v) === idx;
			});
			
			result.values = roots;
			return result;
		},
		
		bbox: function()
		{
			var extrema = this.extrema(),
			result = {};
			this.dims.forEach(
				function(d) {
					result[d] = UT.utils.getminmax(this, d, extrema[d]);
				}.bind(this)
			);
			return result;
		},
		
		overlaps: function(curve)
		{
			var lbbox = this.bbox();
			var tbbox = curve.bbox();
			return UT.utils.bboxoverlap(lbbox, tbbox);
		},
		
		offset: function(t, d)
		{
			if (typeof d !== "undefined")
			{
				var c = this.get(t);
				var n = this.normal(t);
				var ret = {
					c: c,
					n: n,
					x: c.x + n.x * d,
					y: c.y + n.y * d
				};
				
				if (this._3d)
					ret.z = c.z + n.z * d;

				return ret;
			}
			
			if (this._linear)
			{
				var nv = this.normal(0);
				
				var coords = this.points.map(function(p)
				{
					var ret = {
						x: p.x + t * nv.x,
						y: p.y + t * nv.y
					};
					
					if (p.z && n.z)
						ret.z = p.z + t * nv.z;

					return ret;
				});
				
				return [new this.Bezier(coords)];
			}
			
			var reduced = this.reduce();
			return reduced.map(function(s)
			{
				if (s._linear)
					return s.offset(t)[0];

				return s.scale(t);
			});
		},
		
		simple: function()
		{
			if (this.order === 3)
			{
				var a1 = UT.utils.angle(this.points[0], this.points[3], this.points[1]);
				var a2 = UT.utils.angle(this.points[0], this.points[3], this.points[2]);
				
				if ((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0))
					return false;
			}
			
			var n1 = this.normal(0);
			var n2 = this.normal(1);
			var s = n1.x * n2.x + n1.y * n2.y;
			
			if (this._3d)
				s += n1.z * n2.z;

			var angle = abs(acos(s));
			return angle < pi / 3;
		},
		
		reduce: function()
		{
			var i;
			var t1 = 0;
			var t2 = 0;
			var step = 0.01;
			var segment;
			var pass1 = [];
			var pass2 = [];
			
			// first pass: split on extrema
			var extrema = this.extrema().values;
			
			if (extrema.indexOf(0) === -1)
				extrema = [0].concat(extrema);

			if (extrema.indexOf(1) === -1)
				extrema.push(1);
			
			for (t1 = extrema[0], i = 1; i < extrema.length; i++)
			{
				t2 = extrema[i];
				segment = this.split(t1, t2);
				segment._t1 = t1;
				segment._t2 = t2;
				pass1.push(segment);
				t1 = t2;
			}
			
			// second pass: further reduce these segments to simple segments
			pass1.forEach(function(p1)
			{
				t1 = 0;
				t2 = 0;
				while (t2 <= 1)
				{
					for (t2 = t1 + step; t2 <= 1 + step; t2 += step)
					{
						segment = p1.split(t1, t2);
						if (!segment.simple())
						{
							t2 -= step;
							if (abs(t1 - t2) < step)
								// we can never form a reduction
								return [];

							segment = p1.split(t1, t2);
							segment._t1 = UT.utils.map(t1, 0, 1, p1._t1, p1._t2);
							segment._t2 = UT.utils.map(t2, 0, 1, p1._t1, p1._t2);
							pass2.push(segment);
							t1 = t2;
							break;
						}
					}
				}
				
				if (t1 < 1)
				{
					segment = p1.split(t1, 1);
					segment._t1 = UT.utils.map(t1, 0, 1, p1._t1, p1._t2);
					segment._t2 = p1._t2;
					pass2.push(segment);
				}
			});
			return pass2;
		},
		
		scale: function(d)
		{
			var order = this.order;
			var distanceFn = false;
			if (typeof d === "function")
				distanceFn = d;

			if (distanceFn && order === 2)
				return this.raise().scale(distanceFn);
			
			// TODO: add special handling for degenerate (=linear) curves.
			var clockwise = this.clockwise;
			var r1 = distanceFn ? distanceFn(0) : d;
			var r2 = distanceFn ? distanceFn(1) : d;
			var v = [this.offset(0, 10), this.offset(1, 10)];
			var o = UT.utils.lli4(v[0], v[0].c, v[1], v[1].c);
			if (!o)
				MessageLog.trace( "cannot scale this curve. Try reducing it first.");

			// move all points by distance 'd' wrt the origin 'o'
			var points = this.points,
			np = [];
			
			// move end points by fixed distance along normal.
			[0, 1].forEach(
				function(t)
				{
					var p = (np[t * order] = UT.utils.copy(points[t * order]));
					p.x += (t ? r2 : r1) * v[t].n.x;
					p.y += (t ? r2 : r1) * v[t].n.y;
				}.bind(this)
			);
			
			if (!distanceFn)
			{
				// move control points to lie on the intersection of the offset
				// derivative vector, and the origin-through-control vector
				[0, 1].forEach(
					function(t)
					{
						if (this.order === 2 && !!t) return;
						var p = np[t * order];
						var d = this.derivative(t);
						var p2 = { x: p.x + d.x, y: p.y + d.y };
						np[t + 1] = UT.utils.lli4(p, p2, o, points[t + 1]);
					}.bind(this)
				);
				return new this.Bezier(np);
			}
			
			// move control points by "however much necessary to
			// ensure the correct tangent to endpoint".
			[0, 1].forEach(
				function(t)
				{
					if (this.order === 2 && !!t) return;
					var p = points[t + 1];
					var ov = {
						x: p.x - o.x,
						y: p.y - o.y
					};
					var rc = distanceFn ? distanceFn((t + 1) / order) : d;
					if (distanceFn && !clockwise) rc = -rc;
					var m = sqrt(ov.x * ov.x + ov.y * ov.y);
					ov.x /= m;
					ov.y /= m;
					np[t + 1] = {
						x: p.x + rc * ov.x,
						y: p.y + rc * ov.y
					};
				}.bind(this)
			);
			return new this.Bezier(np);
		},
		
		outlineshapes: function(d1, d2, curveIntersectionThreshold)
		{
			d2 = d2 || d1;
			var outline = this.outline(d1, d2).curves;
			var shapes = [];
			for (var i = 1, len = outline.length; i < len / 2; i++)
			{
				var shape = UT.utils.makeshape
				(
					outline[i],
					outline[len - i],
					curveIntersectionThreshold
				);
				
				shape.startcap.virtual = i > 1;
				shape.endcap.virtual = i < len / 2 - 1;
				shapes.push(shape);
			}
			return shapes;
		},
		
		intersects: function(curve, curveIntersectionThreshold)
		{
			if (!curve)
				return this.selfintersects(curveIntersectionThreshold);
			
			if (curve.p1 && curve.p2)
				return this.lineIntersects(curve);

			if (curve instanceof this.Bezier)
				curve = curve.reduce();

			return this.curveintersects(
				this.reduce(),
				curve,
				curveIntersectionThreshold
			);
		},
		
		lineIntersects: function(line)
		{
			var mx = min(line.p1.x, line.p2.x);
			var my = min(line.p1.y, line.p2.y);
			var MX = max(line.p1.x, line.p2.x);
			var MY = max(line.p1.y, line.p2.y);
			var self = this;
			
			return UT.utils.roots(this.points, line).filter(function(t)
			{
				var p = self.get(t);
				return UT.utils.between(p.x, mx, MX) && UT.utils.between(p.y, my, MY);
			});
		},
		
		selfintersects: function(curveIntersectionThreshold)
		{
			var reduced = this.reduce();
			// "simple" curves cannot intersect with their direct
			// neighbour, so for each segment X we check whether
			// it intersects [0:x-2][x+2:last].
			var i;
			var len = reduced.length - 2;
			var results = [];
			var result, left, right;
			
			for (i = 0; i < len; i++)
			{
				left = reduced.slice(i, i + 1);
				right = reduced.slice(i + 2);
				result = this.curveintersects(left, right, curveIntersectionThreshold);
				results = results.concat(result);
			}
			return results;
		},
		
		curveintersects: function(c1, c2, curveIntersectionThreshold)
		{
			var pairs = [];
			
			// step 1: pair off any overlapping segments
			c1.forEach(function(l)
			{
				c2.forEach(function(r)
				{
					if (l.overlaps(r))
						pairs.push({ left: l, right: r });
				});
			});
			
			// step 2: for each pairing, run through the convergence algorithm.
			var intersections = [];
			pairs.forEach(function(pair)
			{
				var result = UT.utils.pairiteration
				(
					pair.left,
					pair.right,
					curveIntersectionThreshold
				);
				
				if (result.length > 0)
					intersections = intersections.concat(result);
			});
			return intersections;
		},
		
		arcs: function(errorThreshold)
		{
			errorThreshold = errorThreshold || 0.5;
			var circles = [];
			return this._iterate(errorThreshold, circles);
		},
		
		_error: function(pc, np1, s, e)
		{
			var q = (e - s) / 4;
			var c1 = this.get(s + q);
			var c2 = this.get(e - q);
			var ref = UT.utils.dist(pc, np1);
			var d1 = UT.utils.dist(pc, c1);
			var d2 = UT.utils.dist(pc, c2);
			
			return abs(d1 - ref) + abs(d2 - ref);
		},
		
		_iterate: function(errorThreshold, circles)
		{
			var t_s = 0;
			var t_e = 1;
			var safety;
			
			// we do a binary search to find the "good `t` closest to no-longer-good"
			do {
				safety = 0;
				
				// step 1: start with the maximum possible arc
				t_e = 1;
				
				// points:
				var np1 = this.get(t_s);
				var np2, np3, arc, prev_arc;
				
				// booleans:
				var curr_good = false;
				var prev_good = false;
				var done;
				
				// numbers:
				var t_m = t_e;
				var prev_e = 1;
				var step = 0;
				
				// step 2: find the best possible arc
				do {
					prev_good = curr_good;
					prev_arc = arc;
					t_m = (t_s + t_e) / 2;
					step++;
					
					np2 = this.get(t_m);
					np3 = this.get(t_e);
					
					arc = UT.utils.getccenter(np1, np2, np3);
					
					//also save the t values
					arc.interval = {
						start: t_s,
						end: t_e
					};
					
					var error = this._error(arc, np1, t_s, t_e);
					curr_good = error <= errorThreshold;
					
					done = prev_good && !curr_good;
					if (!done) prev_e = t_e;
					
					// this arc is fine: we can move 'e' up to see if we can find a wider arc
					if (curr_good)
					{
						// if e is already at max, then we're done for this arc.
						if (t_e >= 1)
						{
							// make sure we cap at t=1
							arc.interval.end = prev_e = 1;
							prev_arc = arc;
							// if we capped the arc segment to t=1 we also need to make sure that
							// the arc's end angle is correct with respect to the bezier end point.
							if (t_e > 1)
							{
								var d = {
									x: arc.x + arc.r * cos(arc.e),
									y: arc.y + arc.r * sin(arc.e)
								};
								arc.e += UT.utils.angle({ x: arc.x, y: arc.y }, d, this.get(1));
							}
							break;
						}
						// if not, move it up by half the iteration distance
						t_e = t_e + (t_e - t_s) / 2;
					}
					else
					{
						// this is a bad arc: we need to move 'e' down to find a good arc
						t_e = t_m;
					}
				}
				while (!done && safety++ < 100);
				
				if (safety >= 100)
					break;
				
				// console.log("L835: [F] arc found", t_s, prev_e, prev_arc.x, prev_arc.y, prev_arc.s, prev_arc.e);
				
				prev_arc = prev_arc ? prev_arc : arc;
				circles.push(prev_arc);
				t_s = prev_e;
			}
			while (t_e < 1);
			
			return circles;
		}
	}
}


exports.bezier_lib = bezier_lib;