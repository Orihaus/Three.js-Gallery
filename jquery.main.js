function recursiveload(vessel, level)
{
    //vessel.level = level;
    console.log(vessel);
	paradiseVessels.push( vessel );
	/*if (!vessel.children || level == 2 || paradiseVessels.length > 25 ) return; //|| level == 2 
	console.log( level )
	$.each(vessel.children, function( index, value ) {
		value.childID = index;
		recursiveload( value, level + 1 );
	});*/
}

$(document).ready(function ()
{
    $.getJSON( "data/paradise.json",
        function (response)
        {
            $.each(response, function (key, val)
            {
                var index = parseInt(key);
                if (index > paradiseIndexSize)
                    paradiseIndexSize = index;
                if (index < paradiseLowestIndex)
                    paradiseLowestIndex = index;

                //console.log(vessel);
                //if (count < 10)
                paradiseVesselsRaw[index] = val;
                 paradiseRawSize++;
            });

            completedLoading();
	    }
	);
});