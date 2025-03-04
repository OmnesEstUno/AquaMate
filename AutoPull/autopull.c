#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>

// Function to daemonize the process
void daemonize() {
    pid_t pid = fork();
    if (pid < 0) {
        perror("Fork error");
        exit(EXIT_FAILURE);
    }
    if (pid > 0) {
        // Parent process, exit
        exit(EXIT_SUCCESS);
    }

    // Create a new session
    if (setsid() < 0) {
        perror("Setsid error");
        exit(EXIT_FAILURE);
    }

    // Change working directory to root
    if (chdir("/") < 0) {
        perror("Chdir error");
        exit(EXIT_FAILURE);
    }

    // Close standard file descriptors
    close(STDIN_FILENO);
    close(STDOUT_FILENO);
    close(STDERR_FILENO);

    // Reopen standard file descriptors to /dev/null
    int dev_null = open("/dev/null", O_RDWR);
    if (dev_null < 0) {
        perror("Open /dev/null error");
        exit(EXIT_FAILURE);
    }
    dup2(dev_null, STDIN_FILENO);
    dup2(dev_null, STDOUT_FILENO);
    dup2(dev_null, STDERR_FILENO);
}

int main() {
    daemonize();

    // One Day interval
    const int interval = 24 * 60 * 60;
    
    while (1) {
        // Perform git pull
        printf("Performing git pull...\n");
        system("git pull");

        // Move to build folder and make new build
        printf("Building...\n");
        system("cd /home/ubuntu/csc648-04-sp24-Team03/application/react-app");
        system("npm i");
        system("npm build");

        // Move to application.js folder and daemonize it
        printf("Performing git pull...\n");
        system("cd /home/ubuntu/csc648-04-sp24-Team03/application/BackEnd");
        system("pm2 kill");
        system("pm2 flush");
        system("pm2 start ./application.js");

        // Sleep for the specified interval
        printf("Sleeping for %d seconds...\n", interval);
        sleep(interval);
    }

    return 0;
}
