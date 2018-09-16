//
// USAGE:
//
// var wb=new WordBoy({
//    sentences:[
//       {
//          label:"Cartrige label 1",
//          text:"Cartrige hidden text 1"
//       },
//       ...
//       "To 4 sentences",
//       "To mix"
//    ],
//    padTo:260,              // Pad the mask and letters to a specific length
//    paddingLetters:"ABC..", // Use these random letters for padding
//    randomSeed:15092018,    // Use a specific random seed for padding letters
//    holeSize:11.5,          // Size of holes on masks
//    columns:20,             // Number of columns of letters
//    backgroundColor:"#fff", // Display background color
//    coverColor:"#000",      // Color used by masks to cover letters
//    transparentColor:"#fff",// Color used by masks for holes
//    fontFamily:"Tahoma",    // Font used for letters
//    fontSize:7.5,           // Font size used for letters
//    fileName:"wordboy.svg"  // Filename of downloaded file
//    metadata:{
//       key:{text:"value"},  // Replaces other labels on key1... object
//       key:{image:"URL"},   // Add image over key1... object
//       ...
//    },
//    injectMap:[             // Inject a specific letter in a position as
//                            // padding
//      {
//         position:3,
//         letter:"T"
//      },
//      ...
// ]
// })
//

WordBoy=function(C) {
	var
		map,svgNode,svgOutput,fileCache=[],fileCacheData={},
		random=C.randomSeed||15092018,
		paddingLetters=C.paddingLetters||"ABCDEFGHILMNOPQRSTUV",
		padTo=C.padTo||260,
		svgModel=C.svgModel||"wordboy.svg",
		holeSize=C.holeSize||11.5,
		columns=C.columns||20,
		backgroundColor=C.backgroundColor||"#fff",
		coverColor=C.coverColor||"#000",
		transparentColor=C.transparentColor||"#fff",
		fontFamily=C.fontFamily||"Tahoma",
		fontSize=C.fontSize||7.5,
		fileName=C.fileName||"wordboy.svg",
		metadata=C.metadata||0,
		injectMap=C.injectMap||[];

	HOLE="~";
	PAD=0.3;

	injectMap.sort(function(a,b){
		if (a.position>b.position) return 1;
		else if (a.position<b.position) return -1;
		else return 0
	});

	function getElementById(node, id) {
	    if (node.id === id) {
	        return node;
	    }

	    var target;

	    node = node.firstChild;
	    while (node) {
	        target = getElementById(node, id);
	        if (target) {
	            return target;
	        }

	        node = node.nextSibling;
	    }

	    return undefined;
	}

	// ***
	// Calculate the letters map.
	// ***

	// Seedable random
	function seededRandom(limit) {
		random = (random * 9301 + 49297) % 233280;
		return Math.floor( random / 233280 * limit);
	}

	// Download a file
	function request(file,cb,responsetype) {
		var xmlhttp = new XMLHttpRequest();
		if (cb)
			xmlhttp.onreadystatechange = function() {
				if (xmlhttp.readyState == 4)
					if ((xmlhttp.status == 200)||(xmlhttp.status==0))
						if (responsetype) {
							var reader = new FileReader();
						    reader.onloadend = function() {
						      cb(reader.result);
						    }
						    reader.readAsDataURL(xmlhttp.response);
						} else cb(xmlhttp.responseText);
					else cb();
			};
		xmlhttp.open("GET", file, true);
		if (responsetype) xmlhttp.responseType = responsetype;
		xmlhttp.send();
	}

	// Download all files in cache
	function processCache(callback) {
		if (!fileCache[0])
			callback();
		else {
			request(fileCache[0].url,function(data){
				fileCacheData[fileCache[0].id]=data;
				fileCache.splice(0,1);
				processCache(callback);
			},fileCache[0].responseType)
		}
	}

	// Repeat a sequence of characters
	function repeat(ch,t) {
		var out="";
		while(out.length<t) out+=ch;
		return out;
	}

	// Create all permutations of an array
	function permutator(arr,result,m) {
		var curr,next;
		if (!m) m=[];
		if (!result) result=[];
		if (arr.length === 0) result.push(m)
		else {
		  for (var i = 0; i < arr.length; i++) {
			 curr = arr.slice();
			 next = curr.splice(i, 1);
			permutator(curr.slice(), result,m.concat(next))
		 }
	   }
	   return result;
	 }

	// Get the longest shared slice of two strings.
	function findSplit(s1,s2) {
		var fp,fl=-1,fa,chunk,pos;
		for (var i=1;i<s1.length;i++) {
			for (var j=0;j<=s1.length-i;j++) {
				chunk=s1.substr(j,i);
				pos=s2.indexOf(chunk);
				if ((pos!=-1)&&(i>fl)) {
					fl=i;
					fp=j;
					fa=pos;
				}
			}	
		}
		return fl==-1?0:{from:fp,len:fl,at:fa};
	}

	// Finds the longest shared part of a sentence and recusively do the same to 
	// the previous and next part.
	function bisect(s1,s2) {
		var part=findSplit(s1,s2);
		if (part) {
			var pc1A=s1.substr(0,part.from);
			var pc2A=s2.substr(0,part.at);
			var pcX=s1.substr(part.from,part.len);
			var pc1B=s1.substr(part.from+part.len);
			var pc2B=s2.substr(part.at+part.len);
			return {
				pre:bisect(pc1A,pc2A),
				mid:pcX,
				post:bisect(pc1B,pc2B)
			}
		} else return {
			pre:s1,
			mid:"",
			post:s2
		}
		
	}

	// Insert a letter in a specific position
	function insertLetter(out,pos,letter) {
		out.letters=out.letters.substr(0,pos)+letter+out.letters.substr(pos);
		for (var i=0;i<out.maps.length;i++)
			out.maps[i].map=out.maps[i].map.substr(0,pos)+HOLE+
				out.maps[i].map.substr(pos);
		return out;
	}

	// Add random letters to a set in order to reach a specific length.
	function addPadding(out,to,paddingletters,injectmap) {
		if (out.letters.length>to-injectmap.length) {
			injectmap=[];
			console.warn("Can't add inject map.");
		} else
			to-=injectmap.length;
		while (out.letters.length<to)
			insertLetter(
				out,
				seededRandom(out.letters.length),
				paddingletters[seededRandom(paddingletters.length)]
			);
		for (var i=0;i<injectmap.length;i++)
			insertLetter(out,injectmap[i].position,injectmap[i].letter);
		return out;
	}

	// Creates a string and a mask "bisect" output using. The string contains
	// all the letters from both of the sentences and the mask contains a
	// a positional sequence of symbols:
	// 1: The related character is for sentence 1 only
	// 2: The related character is for sentence 2 only
	// *: The related character is shared by both sentences
	function rejoin(bisect,mark) {
		if (!mark) mark="*";
		if (typeof bisect=="string") {
			return [bisect,repeat(mark,bisect.length)];
		} else {
			var pre=rejoin(bisect.pre,"1")
			var post=rejoin(bisect.post,"2");
			return [
				pre[0]+bisect.mid+post[0],
				pre[1]+repeat("*",bisect.mid.length)+post[1]
			]
		}
	}

	// Find shared parts of the C.sentences strings and cache them.
	// Uses all combinations of sentences, find the longest shared parts and
	// get the combination with the shortest sequence of shared letters.
	function getMap() {

		if (!map) {

			// Convert to uppercase
			var sentences=[];
			for (var i=0;i<C.sentences.length;i++)
				if (C.sentences[i].text)
					sentences.push({
						text:C.sentences[i].text.replace(/ /g,"").toUpperCase(),
						id:i
					});

			var permutations=permutator(sentences);

			for (var p=0;p<permutations.length;p++) {

				var set=permutations[p];

				var maps=[{
					sentence:set[0],
					map:set[0].text
				}];

				var out=set[0].text;

				for (var i=1;i<set.length;i++) {
					var rej=rejoin(bisect(set[i].text,out));
					out=rej[0];
					var remap=rej[1];

					var newmap="";
					for (var k=0;k<remap.length;k++)
						switch (remap[k]) {
							case "2":{
								newmap+=HOLE;
								break;
							}
							case "1":{
								newmap+=out[k];
								for (j=0;j<maps.length;j++)
									maps[j].map=maps[j].map.substr(0,k)+
										HOLE+maps[j].map.substr(k);
								break;
							}
							case "*":{
								newmap+=out[k];
								break;
							}
						}
					maps.push({
						sentence:set[i],
						map:newmap
					});

				}

				if (!map||(out.length<map.letters.length))
					map={letters:out,maps:maps};

			}

			if (padTo&&paddingLetters) {
				addPadding(map,padTo,paddingLetters,injectMap);

				var injectcard=repeat(HOLE,padTo)
				for (var i=0;i<injectMap.length;i++)
					injectcard=
						injectcard.substr(0,injectMap[i].position)+
						"X"+
						injectcard.substr(injectMap[i].position+1);

				for (var i=0;i<C.sentences.length;i++)
					if (C.sentences[i].injectMap)
						map.maps.push({
							sentence:{id:i},
							map:injectcard
						});

			}

		}

	}

	// ***
	// Creates the printable SVG
	// ***

	// Download and cache the SVG data.
	function loadSvg(cb) {

		if (!fileCacheData.svgData) {
			fileCache.push({id:"svgData",url:svgModel});
			for (var i=0;i<C.sentences.length;i++)
				if (C.sentences[i].metadata)
					for (var a in C.sentences[i].metadata)
						if (C.sentences[i].metadata[a].image)
							fileCache.push({
								id:C.sentences[i].metadata[a].image,
								url:C.sentences[i].metadata[a].image,
								responseType:"blob"
							});
			processCache(function(){
				svgNode = document.createElement("svg");
				svgNode.style.display="none";
				document.body.appendChild(svgNode);
				svgData=fileCacheData.svgData;
				cb();
				document.body.removeChild(svgNode);
			});
		} else
			cb();

	}

	// Draws a rectangle
	function svgRect(parent,x,y,width,height,color) {
		var n = document.createElementNS("http://www.w3.org/2000/svg","rect");
		n.setAttributeNS(null,"x",x);     
		n.setAttributeNS(null,"y",y); 
		n.setAttributeNS(null,"width",width); 
		n.setAttributeNS(null,"height",height); 
		n.setAttributeNS(null,"fill",color);			
		parent.appendChild(n);
	}

	// Draws a text label
	function svgPrint(parent,x,y,color,font,fontSize,text) {
		var n = document.createElementNS("http://www.w3.org/2000/svg","text");
		n.setAttributeNS(null,"x",x);     
		n.setAttributeNS(null,"y",y); 
		n.setAttributeNS(null,"font-size",fontSize);
		n.setAttributeNS(null,"font-family",font);
		n.setAttributeNS(null,"fill",color);			
		n.setAttributeNS(null,"text-anchor","middle");
		n.setAttributeNS(null,"alignment-baseline","central");			
		n.setAttributeNS(null,"dominant-baseline","central");			
		var textNode = document.createTextNode(text);
		n.appendChild(textNode);
		parent.appendChild(n);
	}

	// Draw an image behind a node
	function svgImage(node,x,y,width,height,image) {
		var n = document.createElementNS("http://www.w3.org/2000/svg","image");
		n.setAttributeNS(null,"x",x);     
		n.setAttributeNS(null,"y",y); 
		n.setAttributeNS(null,"width",width);     
		n.setAttributeNS(null,"height",height);
		n.setAttributeNS('http://www.w3.org/1999/xlink',"href",image);
		node.parentNode.insertBefore(n,node);
	}

	// Draw an image over another object
	function svgReimage(node,image) {
		var node=getElementById(svgNode,node);
		if (node)
			svgImage(
				node,
				node.getAttribute("x"),
				node.getAttribute("y"),
				node.getAttribute("width"),
				node.getAttribute("height"),
				image
			);
	}

	// Change SVG node inner text
	function svgRetext(node,text) {
		var node=getElementById(svgNode,node);
		if (node) {
			var textNode = node.getElementsByTagName("text");
			if (textNode.length) textNode[0].textContent=text;
			else {
				textNode=node.getElementsByTagName("tspan");
				textNode[0].innerHTML=text;
			}
		}
	}

	// Append a letters/hole grid in SVG
	function showGrid(node,bgcolor,text,cols,letterwidth,letterheight,hole,hc) {
		var rows=Math.ceil(text.length/cols);
		var grid=getElementById(svgNode,node);
		if (grid) {
			var rect=grid.getElementsByTagName("rect")[0];		
			var width=rect.getAttribute("width")*1;
			var height=rect.getAttribute("height")*1;
			var ox=(rect.getAttribute("x")*1)+((width-(cols*letterwidth))/2);
			var oy=(rect.getAttribute("y")*1)+((height-(rows*letterheight))/2);

			svgRect(
				grid,
				rect.getAttribute("x"),
				rect.getAttribute("y"),
				width,
				height,
				bgcolor
			);

			for (var i=0;i<rows;i++) {
				var row=text.substr(i*cols,cols);
				for (var j=0;j<cols;j++)
					if (row[j])		
						if (hole) {
							if (row[j]!=HOLE)
								svgRect(
									grid,
									ox+(j*letterwidth)-PAD,
									oy+(i*letterheight)-PAD,
									letterwidth+(PAD*2),
									letterheight+(PAD*2),
									hc
								);
						} else
							svgPrint(
								grid,
								ox+(j*letterwidth)+(letterwidth/2),
								oy+(i*letterheight)+(letterheight/2),
								"#000",
								fontFamily,
								fontSize,
								row[j]
							);
			}
		}
		
	}

	function getSvg(cb) {
		if (!svgOutput)
			loadSvg(function() {
				var sentence;
				getMap();
				svgNode.innerHTML=svgData;
				showGrid(
					"letters",
					backgroundColor,
					map.letters,
					columns,
					holeSize,
					holeSize,
					false
				);
				for (var i=0;i<map.maps.length;i++) {
					sentence=C.sentences[map.maps[i].sentence.id];
					svgRetext(
						"label"+(i+1),
						sentence.label);
					showGrid(
						"grid"+(i+1),
						coverColor,
						map.maps[i].map,
						columns,
						holeSize,
						holeSize,
						true,
						transparentColor
					);
					if (sentence.metadata) {
						for (var a in sentence.metadata)
							if (sentence.metadata[a].text)
								svgRetext(
									a+(i+1),
									sentence.metadata[a].text
								);
							else if (sentence.metadata[a].image)
								svgReimage(
									a+(i+1),
									fileCacheData[sentence.metadata[a].image]
								);
					}
				}
				if (metadata)
					for (var a in metadata) svgRetext(a,metadata[a]);
				// Prepare SVG output
				var serializer = new XMLSerializer();
				var source = serializer.serializeToString(svgNode);
				svgOutput=
					svgData.substr(0,svgData.indexOf("<defs"))+
					source.match(/(<defs.*)<\/svg>/s)[1];
				cb(svgOutput);
			})
		else
			cb(svgOutput);
	}

	// ***
	// Public interface
	// ***

	return {

		// Return the text maps.
		getMaps:function() {
			getMap();
			return map;
		},

		// Get SVG sources of the composed map.
		getSvg:function(cb) {
			getSvg(cb);
		},

		// Download SVG sources of the composed map.
		downloadSvg:function() {
			getSvg(function(svg){
				var a = document.createElement("a");
			    document.body.appendChild(a);
			    a.style.dislpay="none";
	            var blob = new Blob([svg], {type: "image/svg+xml"});
	            var url = window.URL.createObjectURL(blob);
		        a.href = url;
		        a.download = fileName;
		        a.click();
		        window.URL.revokeObjectURL(url);
		        document.body.removeChild(a);
			});
		}

	}

}
