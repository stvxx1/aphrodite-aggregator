cmake_minimum_required(VERSION 3.10)
project(AphroditeScraper)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

find_package(CURL REQUIRED)
find_package(Threads REQUIRED)

add_executable(scraper main.cpp)
target_link_libraries(scraper PRIVATE CURL::libcurl Threads::Threads)
