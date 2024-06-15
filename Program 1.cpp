/* Program name: lab.cpp
* Author: Danielle Lloyd
* Date last updated: 6/13/2024
* Purpose: Loads a file and prints results in table.
*/
#include <iostream>
#include <fstream>
#include <string>
#include <iomanip>

using namespace std;


int main()
{
    ifstream inData;
    inData.open("gradebook.txt");
    int stuNum1, stuNum2, stuNum3, stuNum4, stuNum5;
    string sf1, sf2, sf3, sf4, sf5;
    string sl1, sl2, sl3, sl4, sl5;
    double p1, p2, p3, p4, p5;
    char g1, g2, g3, g4, g5;
    cout << fixed << showpoint;
    cout << setprecision(2);
    inData >> stuNum1 >> sf1 >> sl1 >> p1 >> g1;
    inData >> stuNum2 >> sf2 >> sl2 >> p2 >> g2;
    inData >> stuNum3 >> sf3 >> sl3 >> p3 >> g3;
    inData >> stuNum4 >> sf4 >> sl4 >> p4 >> g4;
    inData >> stuNum5 >> sf5 >> sl5 >> p5 >> g5;
    cout << setfill('-') << setw(17) << "+-" << setw(32) << "+-" << setw(12) << "+-" << setw(12) << "+-" << "+" << endl;
    cout << setfill(' ');
    cout << "| " << setw(15) << "Student Num" << "| " << setw(30) << "Student Name" << "| "<< setw(10) << "Percent" << "| " << setw(10) << "Grade" << "|" << endl;
    cout << setfill('-') << setw(17) << "+-" << setw(32) << "+-" << setw(12) << "+-" << setw(12) << "+-" << "+" << endl;
    cout << setfill(' ');
    cout << "| " << setw(15) << stuNum1 << "| " << setw(30) << sf1 +" " + sl1 << "|"<< setw(9) << right << p1 * 100 << "% | " << setw(10) << left << g1 << "|" << endl;
    cout << setfill('-') << setw(17) << "+-" << setw(32) << "+-" << setw(12) << "+-" << setw(12) << "+-" << "+" << endl;
    cout << setfill(' ');
    return 0;
    
}