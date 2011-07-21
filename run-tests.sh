#!/bin/bash

txts=$(tput sgr0) 
txtb=$(tput bold)$(tput setaf 4)

for file in node-secure-standard-test.js node-secure-overridden-test.js node-secure-events-test.js; do
	echo -e "\n${txtb}${file}${txts}"
	node test/$file
done

echo ""
