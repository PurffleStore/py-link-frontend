import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about-py-link',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about-pylink.component.html',
  styleUrl: './about-pylink.component.scss'
})
export class AboutPyLinkComponent { }