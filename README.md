# pastamaker
Pastamaker is a copypasta sharing service running on Nodejs and mongodb. Users can submit new copypasta and search for existing ones.

Searching will start at the start of user input, with the number of possible results returned by the server being 10 + 3*(query.length-1)^2 to prevent short queries from returning half the DB contents. The point is to provide quick access to a copypasta known by the user, not to provide a comprehensive discovery system.

Pastas are cached in memory with the cache being refreshed every few minutes so DB interaction is minimized and search speed increases. Lunr.js is then used to query the copypastas.

##<a href="http://playground.benjaminbaedorf.com:8000">Demo (NSFW Language)</a>