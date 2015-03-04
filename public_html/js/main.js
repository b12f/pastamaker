/* Main.js */

(function main(){
  	"use strict"

	/* Variables
	---------------------------------------------------------------*/
	var historyTimer = 5000;
	var historyTimeout;
	var searchTimer = 150;
	var originalWindowTitle = $('html title').first().html();
	var lastWindowTitle = originalWindowTitle;

	/* Utilities
	---------------------------------------------------------------*/
	function debounce(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	};


	/* Event Listeners
	---------------------------------------------------------------*/
	$(document).on("keydown.empty", function(e){
        if (!e.ctrlKey) {
			$("#search").focus();
        }
	});

	$("#search").on("input", debounce(function(){
		var query = $(this).val();

		//History replacer
		clearTimeout(historyTimeout);
		historyTimeout = setTimeout(function(){
			if(query.length>0)
				window.history.pushState(query, originalWindowTitle + ": "+query, "/"+escape(query.replace(/\s/g, "_")));
			else
				window.history.pushState(query, originalWindowTitle);
			lastWindowTitle = originalWindowTitle + ": "+query;
		}, historyTimer);
		window.history.replaceState("", lastWindowTitle, "/"+escape(query.replace(/\s/g, "_")));

		//JSON Call if query is long enough
		if(query.length>0){
			//Set document title
			$("head title").first().html(originalWindowTitle + ": "+query, "/"+escape(query.replace(/\s/g, "_")));
			
			//Get pasta JSON
			$.getJSON("api/pasta/"+query, function(pastas){
				if($("#search").val().length>0){
					var container = $("#pastas");
					container.children(".pasta").remove();

					//Append pasta to document
					$.each(pastas, function(i, pasta){
						var classes = "";
						if(pasta.fontstack){
							classes += pasta.fontstack+" ";
						}
						if(!pasta.points){pasta.points = 0;}
						container.append("<article id=\""+
							pasta._id
							+"\" class=\"pasta "+
							classes+"\"><h2>"
							+pasta.title+"</h2><p>"+
							pasta.text
							+"</p><div class=\"meta\"><a href=\"#\" rel=\"rate\">good</a> <span class=\"points\">"+
							pasta.points
							+"</span> <a href=\"#\" rel=\"rate\">bad</a> <a href=\"/"+
							pasta._id
							+"\">permalink</a></div></article>");
					});

					//bind clicks on rating links
					$("a[rel=\"rate\"]").off("click.rate").on("click.rate",function(){
						var container = $(this).closest("article");
						var action = $(this).html() === "Good" ? "like" : "dislike";
						var modifier =  $(this).html() === "Good" ? 1 : -1;
						var id = container.attr("id");
						$.post("api/pasta/"+id, "action="+action,function(response){
							container.find("span.points").first().html(parseInt(container.find("span.points").first().html())+modifier);
						}, 'json');
					});
				}
			}).error(function(){
				clearTimeout(historyTimeout);
			});
		}
		else{
			//Set document title and remove pasta
			$("head title").first().html(originalWindowTitle);
			var container = $("#pastas");
			container.children(".pasta").remove();
		}
	}, searchTimer));

	//Bind addform open and closing links
	$("a[rel=\"add\"]").on("click",function(){
		var container = $("#addItem");
		if(container.hasClass("collapsed")){
			container.removeClass("collapsed");
			$(document).off("keydown.empty");
			$("#addTitle").focus();
			$("#pastas").children(".new").addClass("visible");
		}
		else{
			container.addClass("collapsed");
			$(document).on("keydown.empty", function(e){
		        if (!e.ctrlKey) {
					$("#search").focus();
		        }
			});
			$("#pastas").children(".new").removeClass("visible");
		}
	});
	//Bind addform live updater
	$("#addText").on("input",function(){
		$("#newText").html($(this).val().replace(/\n/g,"<br />"));
	});
	$("#addTitle").on("input",function(){
		$("#newTitle").html($(this).val());
	});
	$("input[name=\"fontstack\"]").on("change",function(){
		$("#pastas article.new").removeAttr("class").attr("class", "new visible "+$(this).val());
	});
	//Bind search submit
	$("form[name=\"search\"]").on("submit",function(e){
		e.stopPropagation();
		e.preventDefault();
		$("#search").trigger("input");
		return false;
	});
	//Bind add submit
	$("form[name=\"add\"]").on("submit",function(e){
		e.stopPropagation();
		e.preventDefault();
		var formvals = $(this).serializeArray();
		
		var noErrors = true;
		$.each(formvals, function(i, formval){
			if(formval.value==="" && formval.name!=="tags"){
				noErrors = false;
				$("#add"+formval.name.charAt(0).toUpperCase() + formval.name.substr(1).toLowerCase() + "Error")
					.html("This field is required.");
			}
		});
		if(noErrors){
			$.post("api/pasta/", formvals,function(response){
				$("#addForm").find("input[type=text], textarea").each(function(){$(this).val("");});
				$("#addForm").find("span.error").each(function(){$(this).html("");});
				$("a[rel=\"add\"]").first().click();
				$("#addTitle").focus();
			}, 'json')
			.error(function(response){
				$("#addPastaError").html(response.responseText);
			});
		}
		else{
			var container = $("#pastas");
			container.children(".pasta").remove();
		}
	});
})();