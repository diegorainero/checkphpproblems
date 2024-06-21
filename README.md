# Check PHP Problems

## What is

The node program to check your php site to search and find PHP problems 

The app search:

- Warning problems
- Deprecated problems
- Fatal Error problems
- Alert opened

For every error there is the description and the page of the error


## How to 

### Install

Clone the repo 

``` npm install ```

### Config

You must configure the .env file using the .env.sample as model. 

### Launch

To scan all the site recursively

``` npm pupeeter.mjs ```

To begin the scan from a specific url

``` npm pupeeter.mjs --url xxxx ```

## Dependants

[Puppeeter](https://github.com/puppeteer/puppeteer)

[Chalk](https://github.com/chalk/chalk)

[Minimist](https://github.com/minimistjs/minimist)
